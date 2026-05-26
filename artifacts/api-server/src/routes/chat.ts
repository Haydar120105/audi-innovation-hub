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

function buildSystemPrompt(collectedFields: Record<string, unknown>): string {
  const missing = REQUIRED_FIELDS.filter((f) => !collectedFields[f]);
  const collected = REQUIRED_FIELDS.filter((f) => collectedFields[f]);

  const collectedSummary =
    collected.length > 0
      ? collected.map((f) => `${f}: ${JSON.stringify(collectedFields[f])}`).join(", ")
      : "none yet";

  const missingSummary = missing.length > 0 ? missing.join(", ") : "all collected";
  const nextQuestion = missing.length > 0 ? FIELD_QUESTIONS[missing[0]] : null;

  return `You are the official AI assistant for the Audi Innovation Hub — Audi AG's startup collaboration program. Your role is to guide startup founders through the application by collecting key information in a natural, friendly conversation.

## What you can discuss
- What the Audi Innovation Hub is and what it offers startups (mentoring, pilot projects, resources, access to Audi infrastructure)
- The 6 departments and what they are looking for:
${DEPARTMENTS.map((d) => `  - ${d.name}`).join("\n")}
- The application and evaluation process (AI scoring, department routing, 2-week review cycle)
- What happens after submission (review → potential pitch invitation)
- General questions about Audi's innovation strategy

## What you must NOT do
- Discuss topics unrelated to Audi, automotive innovation, or this application
- Make promises about acceptance or outcomes
- Provide general business consulting outside the Audi context

## Your primary mission
Collect the following startup information through natural conversation. One question at a time — never ask multiple questions in one reply. If the user volunteers information, extract it immediately via the tool, then ask the next missing field.

**Already collected:** ${collectedSummary}
**Still needed:** ${missingSummary}

${
  missing.length === 0
    ? "All required fields are collected. Congratulate the user briefly and let them know they can now submit their application using the button that appeared."
    : `The NEXT field to collect is: **${missing[0]}**. After acknowledging the user's last message, ask exactly this: "${nextQuestion}"`
}

## CRITICAL — Conversation rhythm
Every single response MUST follow this structure:
1. One short sentence acknowledging what the user just said (if they said something).
2. Immediately ask the next missing field using the question above — word for word or a natural paraphrase.

NEVER end a response without a clear, specific question. The user must always know exactly what to provide next. Do not add filler, do not summarise what you've collected so far, do not explain the process unless asked.

When you identify ANY startup information in the conversation, immediately call the save_startup_info tool — even for partial info. Extract as you go, do not wait.

## Tone & style
- Professional, warm, and concise — matching Audi's premium brand
- Respond in the same language the user writes in (auto-detect German/English)
- Keep responses to 2–3 sentences maximum
- Never sound like a form — sound like a sharp, friendly colleague`;
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
      // Claude only called the tool without a conversational reply — do a follow-up.
      // IMPORTANT: rebuild the system prompt with the newly extracted fields merged in,
      // otherwise the follow-up still thinks the just-saved fields are missing and
      // asks the same question again.
      const mergedForFollowUp = { ...collectedFields, ...extractedFields };
      const updatedSystemPrompt = buildSystemPrompt(mergedForFollowUp);

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
        system: updatedSystemPrompt,   // ← uses merged fields, not stale original
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

    // Tell the frontend which field is being asked about AFTER this round of extraction.
    // The frontend uses this to show the right quick-reply chips.
    const mergedFields = { ...collectedFields, ...extractedFields };
    const stillMissing = REQUIRED_FIELDS.filter((f) => !mergedFields[f]);
    const currentField = stillMissing[0] ?? null;

    res.json({ reply: replyText, extractedFields, currentField });
  } catch (err) {
    req.log.error({ err }, "Chat endpoint error");
    res.status(500).json({ error: "Failed to process message" });
  }
});

export default router;
