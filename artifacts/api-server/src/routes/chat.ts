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

const REQUIRED_FIELDS = ["companyName", "problem", "solution", "technology", "stage", "teamSize", "targetDepartments"];

function buildSystemPrompt(collectedFields: Record<string, unknown>): string {
  const missing = REQUIRED_FIELDS.filter((f) => !collectedFields[f]);
  const collected = REQUIRED_FIELDS.filter((f) => collectedFields[f]);

  const collectedSummary =
    collected.length > 0
      ? collected.map((f) => `${f}: ${JSON.stringify(collectedFields[f])}`).join(", ")
      : "none yet";

  const missingSummary = missing.length > 0 ? missing.join(", ") : "all collected";

  return `You are the official AI assistant for the Audi Innovation Hub — Audi AG's startup collaboration program. Your role is to help startup founders understand the program and collect information about their company for the application.

## What you can discuss
- What the Audi Innovation Hub is and what it offers startups (mentoring, pilot projects, resources, access to Audi infrastructure)
- The 6 departments and what they are looking for:
${DEPARTMENTS.map((d) => `  - ${d.name}`).join("\n")}
- The application and evaluation process (AI scoring, department routing, 2-week review cycle)
- What happens after submission
- General questions about Audi's innovation strategy

## What you must NOT do
- Discuss topics unrelated to Audi, automotive innovation, or this application
- Make promises about acceptance or outcomes
- Provide general business consulting outside the Audi context

## Your primary mission
Collect the following startup information through natural conversation. Do NOT ask all questions at once — guide naturally. If the user volunteers information, extract it immediately.

**Already collected:** ${collectedSummary}
**Still needed:** ${missingSummary}

${missing.length === 0 ? "All required fields are collected. Let the user know they can now submit their application." : `Focus on naturally collecting: ${missing.join(", ")}`}

When you identify ANY startup information in the conversation, immediately call the save_startup_info tool — even for partial info. Extract as you go, do not wait.

## Tone & style
- Professional, warm, and concise — matching Audi's premium brand
- Respond in the same language the user writes in (auto-detect German/English)
- Keep answers to 2–4 sentences unless a detailed explanation is explicitly requested
- Never sound like a form — sound like a knowledgeable colleague`;
}

const SAVE_TOOL = {
  name: "save_startup_info",
  description:
    "Save startup information as you extract it from the conversation. Call this immediately when you identify any relevant field — even partial information. Do not wait until you have everything.",
  input_schema: {
    type: "object" as const,
    properties: {
      companyName: { type: "string", description: "The startup company name" },
      website: { type: "string", description: "Company website or LinkedIn URL" },
      problem: {
        type: "string",
        description: "What problem they solve and who their target customers are",
      },
      solution: { type: "string", description: "Their solution or product" },
      technology: {
        type: "string",
        description: "Core technology and what makes it unique",
      },
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
    const systemPrompt = buildSystemPrompt(collectedFields);
    const formattedMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const firstResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: [SAVE_TOOL],
      tool_choice: { type: "auto" },
      messages: formattedMessages,
    });

    const extractedFields: Record<string, unknown> = {};
    let replyText = "";

    const textBlocks = firstResponse.content.filter((b) => b.type === "text");
    const toolBlocks = firstResponse.content.filter((b) => b.type === "tool_use");

    // Extract fields from any tool calls
    for (const block of toolBlocks) {
      if (block.type === "tool_use" && block.name === "save_startup_info") {
        const fields = block.input as Record<string, unknown>;
        for (const [key, val] of Object.entries(fields)) {
          const isEmpty =
            val === undefined ||
            val === null ||
            val === "" ||
            (Array.isArray(val) && val.length === 0);
          if (!isEmpty) extractedFields[key] = val;
        }
      }
    }

    if (textBlocks.length > 0) {
      replyText = textBlocks
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
    } else if (toolBlocks.length > 0 && firstResponse.stop_reason === "tool_use") {
      // Claude only called the tool without a conversational reply — do a follow-up
      const toolResults = toolBlocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.type === "tool_use" ? b.id : "",
          content: "Saved.",
        }));

      const followUp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...formattedMessages,
          { role: "assistant" as const, content: firstResponse.content },
          { role: "user" as const, content: toolResults },
        ],
      });

      replyText = followUp.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
    }

    res.json({ reply: replyText, extractedFields });
  } catch (err) {
    req.log.error({ err }, "Chat endpoint error");
    res.status(500).json({ error: "Failed to process message" });
  }
});

export default router;
