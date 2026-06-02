import { Router } from "express";
import { inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, hubConfigTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  DEFAULT_FIELD_QUESTIONS,
  DEFAULT_SYSTEM_PROMPT_INTRO,
} from "./hub-config-defaults";

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
  "applicantType",
  "companyName",
  "problem",
  "solution",
  "technology",
  "stage",
  "teamSize",
  "targetDepartments",
];

const HACKATHON_TYPES = ["student_team", "pre_seed_idea", "solo_founder", "university_research"];

// ── In-memory config cache (60 s TTL) ────────────────────────────────────────
interface ChatConfig {
  questions: Record<string, string>;
  systemPromptIntro: string;
  cachedAt: number;
}

let chatConfigCache: ChatConfig | null = null;
const CACHE_TTL = 60_000;

async function loadChatConfig(): Promise<Omit<ChatConfig, "cachedAt">> {
  if (chatConfigCache && Date.now() - chatConfigCache.cachedAt < CACHE_TTL) {
    return chatConfigCache;
  }

  try {
    const rows = await db
      .select()
      .from(hubConfigTable)
      .where(inArray(hubConfigTable.key, ["chat_questions", "chat_system_prompt"]));

    let questions: Record<string, string> = { ...DEFAULT_FIELD_QUESTIONS };
    let systemPromptIntro = DEFAULT_SYSTEM_PROMPT_INTRO;

    for (const row of rows) {
      if (row.key === "chat_questions") {
        // Merge: DB values override defaults, allowing partial overrides
        questions = { ...questions, ...(row.value as Record<string, string>) };
      } else if (row.key === "chat_system_prompt") {
        const val = row.value as { intro?: string };
        if (val?.intro) systemPromptIntro = val.intro;
      }
    }

    chatConfigCache = { questions, systemPromptIntro, cachedAt: Date.now() };
    return chatConfigCache;
  } catch {
    // DB unavailable → return hardcoded defaults silently
    return { questions: DEFAULT_FIELD_QUESTIONS, systemPromptIntro: DEFAULT_SYSTEM_PROMPT_INTRO };
  }
}

// ── Reply prompt builder ──────────────────────────────────────────────────────
/**
 * Builds the system prompt for the REPLY step.
 * collectedFields must already include anything just extracted in the extraction step.
 */
function buildReplyPrompt(
  collectedFields: Record<string, unknown>,
  questions: Record<string, string>,
  systemPromptIntro: string,
): string {
  const missing = REQUIRED_FIELDS.filter((f) => !collectedFields[f]);
  const collected = REQUIRED_FIELDS.filter((f) => collectedFields[f]);

  const collectedSummary =
    collected.length > 0
      ? collected.map((f) => `${f}: ${JSON.stringify(collectedFields[f])}`).join(", ")
      : "none yet";

  const nextField = missing[0] ?? null;
  const nextQuestion = nextField ? (questions[nextField] ?? DEFAULT_FIELD_QUESTIONS[nextField]) : null;

  return `${systemPromptIntro}

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
- What happens after submission (2-week review → pitch invitation if shortlisted)${
  HACKATHON_TYPES.includes(collectedFields["applicantType"] as string)
    ? `

## Important: Hackathon Pathway
This person identified as "${collectedFields["applicantType"]}". In your VERY NEXT response, warmly recommend the IPAI Innovation Hackathon in Heilbronn as a much better fit for them before proceeding. Key points to mention:
- It's a hands-on full day at the IPAI Innovation Park in Heilbronn
- They solve real, concrete challenges from Audi departments — in teams, on-site
- Great for students, solo founders, and early-stage ideas
- They can pick a date slot right here in the chat
- They can still continue with a full Innovation Hub application if they prefer
Be warm, enthusiastic, and make it sound like a genuine opportunity — not a consolation prize.`
    : ""
}`;
}

// ── Tool definition ───────────────────────────────────────────────────────────
const SAVE_TOOL = {
  name: "save_startup_info",
  description:
    "Extract and save any startup information mentioned in the conversation. Call this even if only partial info is available. If nothing new was mentioned, call it with no fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      applicantType: {
        type: "string",
        enum: ["startup", "student_team", "pre_seed_idea", "solo_founder", "university_research"],
        description: "Type of applicant: startup = company/established, student_team = students/university project, pre_seed_idea = early idea without a company yet, solo_founder = individual building alone, university_research = academic research group",
      },
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

// ── Route ─────────────────────────────────────────────────────────────────────
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

    // Load config (DB with 60 s cache, falls back to hardcoded defaults)
    const { questions, systemPromptIntro } = await loadChatConfig();

    // ── STEP 1: Extraction ────────────────────────────────────────────────────
    // Force a tool call so we always know what was just mentioned.
    // This runs BEFORE the reply, ensuring the reply prompt has up-to-date fields.
    const extractionRes = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system:
        "You are a data extractor. Look at the full conversation and call save_startup_info with any startup information you can identify. If nothing relevant was mentioned, still call the tool — just omit those fields.",
      tools: [SAVE_TOOL],
      tool_choice: { type: "any" },
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
    const replyPrompt = buildReplyPrompt(mergedFields, questions, systemPromptIntro);

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
