import { Router } from "express";
import multer from "multer";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are supported"));
  },
});

const REQUIRED_FIELDS = ["companyName", "problem", "solution", "technology", "stage", "teamSize", "targetDepartments"];
const ALL_FIELDS = [...REQUIRED_FIELDS, "website", "pitchDeckUrl", "additionalContext"];

router.post("/extract-pdf", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No PDF file provided" });
    return;
  }

  const pdfBase64 = req.file.buffer.toString("base64");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            } as never,
            {
              type: "text",
              text: `Extract startup information from this document (likely a pitch deck or company overview).

Return a JSON object with only the fields you actually found. Use exactly these field names:

{
  "companyName": "string — company name",
  "website": "string — website or LinkedIn URL",
  "problem": "string — what problem they solve and target customers",
  "solution": "string — their solution/product description",
  "technology": "string — core technology and differentiation",
  "stage": "one of: pre-seed | seed | series-a | series-b-plus | mvp-beta | revenue-generating",
  "teamSize": "string — team size and key expertise",
  "targetDepartments": "array of: production | rd | design | logistics | sales | digital",
  "pitchDeckUrl": "string — any URL mentioned in the document",
  "additionalContext": "string — traction, funding, key metrics, competitive advantage"
}

Rules:
- Only include fields you found clear evidence for — do not invent or guess
- For targetDepartments, infer from context (e.g. a factory automation startup → production, digital)
- Return ONLY the JSON object with no markdown, no explanation`,
            },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response format from AI" });
      return;
    }

    let raw = block.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
    }

    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      res.status(500).json({ error: "Failed to parse extraction result" });
      return;
    }

    // Clean up: remove empty values
    for (const key of Object.keys(extracted)) {
      const val = extracted[key];
      if (val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
        delete extracted[key];
      }
    }

    const found = ALL_FIELDS.filter((f) => extracted[f]);
    const missing = REQUIRED_FIELDS.filter((f) => !extracted[f]);

    req.log.info({ found, missing }, "PDF extraction complete");
    res.json({ extracted, found, missing });
  } catch (err) {
    req.log.error({ err }, "PDF extraction error");
    res.status(500).json({ error: "Failed to extract PDF content" });
  }
});

export default router;
