import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../../lib/logger";

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

export async function analyzeApplication(
  transcript: TranscriptMessage[],
  companyName: string,
): Promise<AnalysisResult> {
  const transcriptText = transcript
    .map((m) => `${m.role === "assistant" ? "Interviewer" : "Applicant"}: ${m.content}`)
    .join("\n");

  const prompt = `You are an expert innovation analyst at Audi AG. You have just reviewed a startup application interview transcript for the Audi Innovation Hub program.

Company: ${companyName}

Interview Transcript:
${transcriptText}

Your task is to analyze this startup and return a JSON response with exactly this structure:

{
  "structuredData": {
    "companyName": "...",
    "problemStatement": "...",
    "solution": "...",
    "technology": "...",
    "stage": "...",
    "teamSize": "...",
    "traction": "...",
    "targetCollaboration": "...",
    "pitchDeckUrl": "...",
    "website": "..."
  },
  "departmentScores": [
    ${DEPARTMENTS.map((d) => `{"departmentId": "${d.id}", "departmentName": "${d.name}", "score": <0-100>, "justification": "<one sentence>"}`).join(",\n    ")}
  ],
  "businessCases": [
    {
      "departmentId": "<id of top 2 departments by score>",
      "departmentName": "<name>",
      "brief": "<200-word business case brief explaining why this startup would be valuable for this Audi department, what the collaboration could look like, and what business outcomes are possible>"
    }
  ]
}

Scoring guidelines:
- Score 0-100 on how relevant this startup is for each department
- Consider technology fit, use cases, and potential for pilot projects
- Only include business cases for the top 2 scoring departments

Return ONLY the JSON object, no markdown, no explanation.`;

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
