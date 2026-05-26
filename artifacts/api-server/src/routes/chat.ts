import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../lib/auth";

const router = Router();

const DEPARTMENTS = [
  { id: "production", name: "Production & Manufacturing" },
  { id: "rd", name: "Research & Development" },
  { id: "design", name: "Design Studio" },
  { id: "logistics", name: "Logistics & Supply Chain" },
  { id: "sales", name: "Sales & Customer Experience" },
  { id: "digital", name: "Digital & IT" },
];

const REQUIRED_FIELDS = [
  "companyName",
  "problem",
  "solution",
  "technology",
  "stage",
  "teamSize",
  "targetDepartments",
];

const FIELD_QUESTIONS: Record<string, string> = {
  companyName: "What's the name of your startup?",
  problem: "What problem are you solving, and who are your target customers?",
  solution: "How does your solution work — what do you actually build or offer?",
  technology: "What's the core technology behind it, and what makes it defensible or unique?",
  stage: "What stage is your company at right now — pre-seed, seed, Series A, or further along?",
  teamSize: "How many people are on your team, and what are the key areas of expertise?",
  targetDepartments:
    "Which Audi departments do you think you could collaborate with most effectively? We have: Production & Manufacturing, R&D, Design Studio, Logistics & Supply Chain, Sales & Customer Experience, and Digital & IT.",
};

/**
 * Builds the system prompt for the REPLY step.
 * collectedFields must already include anything just extracted in the extraction step.
 */
function buildReplyPrompt(collectedFields: Record<string, unknown>): string {
  const missing = REQUIRED_FIELDS.filter((f) => !collectedFields[f]);
  const collected = REQUIRED_FIELDS.filter((f) => collectedFields[f]);

  const collectedSummary =
    collected.length > 0
      ? collected.map((f) => `${f}: ${JSON.stringify(collectedFields[f])}`).join(", ")
      : "none yet";

  const nextField = missing[0] ?? null;
  const nextQuestion = nextField ? FIELD_QUESTIONS[nextField] : null;

  return `You are the official AI assistant for the Audi Innovation Hub — Audi AG's startup collaboration program.

## Information already collected
${collectedSummary}

## What you must ask next
${
  missing.length === 0
    ? "All required fields have been collected. Congratulate the user and tell them the 'Submit Application' button is now visible."
    : `The next missing field is **${nextField}**. Ask: "${nextQuestion}"`
}

## Rules — follow these exactly
1. Write ONE short sentence acknowledging what the user just said (if they said something useful).
2. Immediately ask the next question above — no detours.
3. Maximum 2–3 sentences total. No lists, no summaries, no filler.
4. NEVER ask about a field that is already in "Information already collected".
5. Respond in the same language the user is writing in.
6. Sound like a sharp, friendly colleague — not a form.

## What you can discuss if directly asked
- What the Audi Innovation Hub offers startups (mentoring, pilot projects, access to Audi)
- The 6 departments: ${DEPARTMENTS.map((d) => d.name).join(", ")}
- What happens after submission (2-week review → pitch invitation if shortlisted)`;
}

const SAVE_TOOL = {
  name: "save_startup_info",
  description:
    "Extract and save any startup information mentioned in the conversation. Call this even if only partial info is available. If nothing new was mentioned, call it with no fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      companyName: { type: "string", description: "The startup company name" },
      website: { type: "string", description: "Company website or LinkedIn URL" },
      problem: { type: "string", description: "What problem they solve and who their target customers are" },
      solution: { type: "string", description: "Their solution or product" },
      technology: { type: "string", description: "Core technology and what makes it unique" },
      stage: {
        type: "string",
        enum: ["pre-seed", "seed", "series-a", "series-b-plus", "mvp-beta", "revenue-generating"],
        description: "Company funding or development stage",
      },
      teamSize: { type: "string", description: "Team size and key expertise areas" },
      targetDepartments: {
        type: "array",
        items: {
          type: "string",
          enum: ["production", "rd", "design", "logistics", "sales", "digital"],
        },
        description: "Which Audi departments the startup wants to collaborate with",
      },
      pitchDeckUrl: { type: "string", description: "URL to pitch deck or additional materials" },
      additionalContext: {
        type: "string",
        description: "Any other relevant info: traction, funding, key metrics, competitive advantage",
      },
    },
    required: [],
  },
};

router.post("/chat", requireAuth, async (req, res): Promise<void> => {
  const { messages, collectedFields = {} } = req.body as {
    messages: Array<{ role: string; content: string }>;
    collectedFields: Record<string, unknown>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required and must not be empty" });
    return;
  }

  try {
    const formattedMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // ── STEP 1: Extraction ────────────────────────────────────────────────────
    // Force a tool call so we always know what was just mentioned.
    // This runs BEFORE the reply, ensuring the reply prompt has up-to-date fields.
    const extractionRes = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system:
        "You are a data extractor. Look at the full conversation and call save_startup_info with any startup information you can identify. If nothing relevant was mentioned, still call the tool — just omit those fields.",
      tools: [SAVE_TOOL],
      tool_choice: { type: "required" },
      messages: formattedMessages,
    });

    const extractedFields: Record<string, unknown> = {};
    for (const block of extractionRes.content) {
      if (block.type === "tool_use" && block.name === "save_startup_info") {
        for (const [key, val] of Object.entries(block.input as Record<string, unknown>)) {
          const isEmpty =
            val === undefined ||
            val === null ||
            val === "" ||
            (Array.isArray(val) && val.length === 0);
          if (!isEmpty) extractedFields[key] = val;
        }
      }
    }

    // ── STEP 2: Reply ─────────────────────────────────────────────────────────
    // Build prompt with merged fields — extraction already happened, so this
    // prompt accurately knows what's still missing and asks for the right thing.
    const mergedFields = { ...collectedFields, ...extractedFields };
    const replyPrompt = buildReplyPrompt(mergedFields);

    const replyRes = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: replyPrompt,
      messages: formattedMessages, // clean history, no tool-use overhead
    });

    const replyText = replyRes.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    // ── currentField: what the bot is now asking about ────────────────────────
    const stillMissing = REQUIRED_FIELDS.filter((f) => !mergedFields[f]);
    const currentField = stillMissing[0] ?? null;

    res.json({ reply: replyText, extractedFields, currentField });
  } catch (err) {
    req.log.error({ err }, "Chat endpoint error");
    res.status(500).json({ error: "Failed to process message" });
  }
});

export default router;
