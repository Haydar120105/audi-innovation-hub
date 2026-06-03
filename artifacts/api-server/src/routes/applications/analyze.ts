import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, hubConfigTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { DEFAULT_ANALYSIS_PROMPT } from "../hub-config-defaults";

export interface TranscriptMessage {
  role: string;
  content: string;
}

export interface DepartmentScore {
  departmentId: string;
  departmentName: string;
  score: number;
  justification: string;
}

export interface BusinessCase {
  departmentId: string;
  departmentName: string;
  brief: string;
}

export interface AnalysisResult {
  structuredData: Record<string, unknown>;
  departmentScores: DepartmentScore[];
  businessCases: BusinessCase[];
}

const DEPARTMENTS = [
  { id: "production", name: "Production & Manufacturing" },
  { id: "rd", name: "Research & Development" },
  { id: "design", name: "Design Studio" },
  { id: "logistics", name: "Logistics & Supply Chain" },
  { id: "sales", name: "Sales & Customer Experience" },
  { id: "digital", name: "Digital & IT" },
];

// ── In-memory prompt cache (60 s TTL) — same pattern as chat.ts ──────────────
let cachedPrompt: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000;

async function getAnalysisPrompt(): Promise<string> {
  if (Date.now() < cacheExpiry && cachedPrompt !== null) return cachedPrompt;

  try {
    const rows = await db
      .select()
      .from(hubConfigTable)
      .where(eq(hubConfigTable.key, "analysis_prompt"));

    cachedPrompt = (rows[0]?.value as string | null) ?? DEFAULT_ANALYSIS_PROMPT;
  } catch {
    // DB unavailable — fall back to hardcoded default silently
    cachedPrompt = DEFAULT_ANALYSIS_PROMPT;
  }

  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedPrompt;
}

/** Call this after a successful PUT /admin/config/analysis_prompt to bust the cache immediately. */
export function bustAnalysisPromptCache(): void {
  cachedPrompt = null;
  cacheExpiry = 0;
}

export async function analyzeApplication(
  transcript: TranscriptMessage[],
  companyName: string,
): Promise<AnalysisResult> {
  const transcriptText = transcript
    .map((m) => `${m.role === "assistant" ? "Interviewer" : "Applicant"}: ${m.content}`)
    .join("\n");

  // Build the departments JSON snippet that replaces {{departmentsList}}
  const departmentsList = DEPARTMENTS.map(
    (d) =>
      `{"departmentId": "${d.id}", "departmentName": "${d.name}", "score": <0-100>, "justification": "<one sentence>"}`,
  ).join(",\n    ");

  const template = await getAnalysisPrompt();
  const prompt = template
    .replace("{{companyName}}", companyName)
    .replace("{{transcriptText}}", transcriptText)
    .replace("{{departmentsList}}", departmentsList);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from AI");
  }

  let text = block.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  }

  try {
    const result = JSON.parse(text) as AnalysisResult;
    logger.info({ companyName }, "AI analysis complete");
    return result;
  } catch (err) {
    logger.error({ err, text }, "Failed to parse AI response");
    throw new Error("Failed to parse AI analysis response");
  }
}
