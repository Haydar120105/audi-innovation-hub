import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useSubmitApplication } from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";

const AUDI_RED = "#BB0A21";

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "assistant" | "user";
  content: string;
  isPdf?: boolean;
}

interface CollectedFields {
  companyName?: string;
  website?: string;
  problem?: string;
  solution?: string;
  technology?: string;
  stage?: string;
  teamSize?: string;
  targetDepartments?: string[];
  pitchDeckUrl?: string;
  additionalContext?: string;
}

const REQUIRED_FIELDS: (keyof CollectedFields)[] = [
  "companyName",
  "problem",
  "solution",
  "technology",
  "stage",
  "teamSize",
  "targetDepartments",
];

const FIELD_LABELS: Record<string, string> = {
  companyName: "Company name",
  problem: "Problem & customers",
  solution: "Solution",
  technology: "Technology",
  stage: "Stage",
  teamSize: "Team size",
  targetDepartments: "Target departments",
};

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Welcome to the Audi Innovation Hub. I'm here to learn about your startup and guide you through the application — you can ask me anything about the program, or just start telling me about what you're building.\n\nYou can also upload a pitch deck (PDF) and I'll extract the information automatically.",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl rounded-tl-sm w-fit"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full inline-block"
          style={{
            background: "rgba(255,255,255,0.4)",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function BotAvatar() {
  return (
    <div
      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 mt-0.5"
      style={{ background: AUDI_RED }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
        <circle cx="6" cy="6" r="5" stroke="white" strokeWidth="1.5" fill="none" />
        <path d="M4 6h4M6 4v4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function FieldProgress({ fields, collected }: { fields: (keyof CollectedFields)[]; collected: CollectedFields }) {
  const done = fields.filter((f) => collected[f]).length;
  const total = fields.length;
  const allDone = done === total;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
        style={{
          background: allDone ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${allDone ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
          color: allDone ? "rgba(34,197,94,0.9)" : "rgba(255,255,255,0.4)",
        }}
      >
        {allDone ? (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Ready to submit
          </>
        ) : (
          `${done} / ${total} fields`
        )}
      </div>
    </div>
  );
}

function SuccessScreen({ result }: { result: Application }) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const scores = (result.departmentScores ?? []) as Array<{
    departmentId: string;
    departmentName: string;
    score: number;
    justification: string;
  }>;
  const topDepts = [...scores].sort((a, b) => b.score - a.score).slice(0, 3);

  const base =
    typeof window !== "undefined"
      ? window.location.origin + (import.meta.env.BASE_URL?.replace(/\/$/, "") || "")
      : "";
  const trackingUrl = result.trackingToken ? `${base}/track/${result.trackingToken}` : null;

  const handleCopy = () => {
    if (!trackingUrl) return;
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-20"
      style={{ background: "linear-gradient(135deg, #0A0A14 0%, #0D0B1C 50%, #0A0A14 100%)" }}
    >
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div className="max-w-2xl w-full text-center" style={{ animation: "fadeUp 0.6s ease forwards" }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ background: "rgba(187,10,33,0.15)", border: `1.5px solid ${AUDI_RED}` }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 14.5L11 20.5L23 8" stroke={AUDI_RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-4" style={{ color: AUDI_RED }}>
          Application Received
        </p>
        <h1 className="text-3xl md:text-4xl font-light text-white leading-tight mb-4">
          Thank you, <span className="font-semibold">{result.companyName}.</span>
        </h1>
        <p className="text-white/50 text-base leading-relaxed mb-8 max-w-lg mx-auto">
          Our team has analysed your application and identified the departments most relevant to your technology.
        </p>

        {trackingUrl && (
          <div
            className="mb-10 p-5 rounded-sm text-left"
            style={{ background: "rgba(187,10,33,0.06)", border: "1px solid rgba(187,10,33,0.2)" }}
          >
            <p className="text-xs tracking-[0.15em] uppercase font-semibold mb-2" style={{ color: AUDI_RED }}>
              Your tracking link
            </p>
            <p className="text-white/40 text-xs mb-3 leading-relaxed">
              Bookmark this link to check your application status at any time. No login required.
            </p>
            <div
              className="flex items-center gap-2 p-3 rounded-sm"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-white/50 text-xs flex-1 truncate font-mono">{trackingUrl}</p>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={
                  copied
                    ? { background: "rgba(80,200,100,0.15)", color: "rgba(80,200,100,0.9)", border: "1px solid rgba(80,200,100,0.3)" }
                    : { background: "rgba(187,10,33,0.15)", color: AUDI_RED, border: `1px solid rgba(187,10,33,0.3)` }
                }
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {topDepts.length > 0 && (
          <div className="mb-12">
            <p className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold mb-6">
              Top department matches
            </p>
            <div className="space-y-3">
              {topDepts.map((d) => (
                <div
                  key={d.departmentId}
                  className="flex items-center gap-4 p-4 rounded-sm text-left"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{d.departmentName}</p>
                    <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{d.justification}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-semibold" style={{ color: AUDI_RED }}>{d.score}</p>
                    <p className="text-white/30 text-xs">/ 100</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <button className="px-6 py-3 text-sm font-semibold text-white/60 border border-white/10 rounded-sm hover:border-white/20 transition-colors">
              ← Back to Hub
            </button>
          </Link>
          <button
            onClick={() => navigate(`/applications/${result.id}`)}
            className="px-6 py-3 text-sm font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
            style={{ background: AUDI_RED }}
          >
            View Full Analysis →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Apply() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [collectedFields, setCollectedFields] = useState<CollectedFields>({});
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Application | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: submitApp } = useSubmitApplication();

  const allRequiredFilled = REQUIRED_FIELDS.every((f) => collectedFields[f]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isPdfLoading]);

  useEffect(() => {
    if (!isLoading && !isPdfLoading && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [isLoading, isPdfLoading, isSubmitting]);

  const mergeFields = useCallback((newFields: Record<string, unknown>) => {
    setCollectedFields((prev) => {
      const merged = { ...prev };
      for (const [key, val] of Object.entries(newFields)) {
        if (val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0)) {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      return merged;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = { role: "user", content: text };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInputValue("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            collectedFields,
          }),
        });

        if (!res.ok) throw new Error("Chat request failed");

        const data = (await res.json()) as { reply: string; extractedFields: Record<string, unknown> };

        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (data.extractedFields && Object.keys(data.extractedFields).length > 0) {
          mergeFields(data.extractedFields);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Something went wrong — please try again or contact startup@audi.de.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, collectedFields, isLoading, mergeFields],
  );

  const handlePdfUpload = useCallback(
    async (file: File) => {
      if (isPdfLoading) return;

      const pdfMsg: Message = {
        role: "user",
        content: `📄 Uploaded: ${file.name}`,
        isPdf: true,
      };
      setMessages((prev) => [...prev, pdfMsg]);
      setIsPdfLoading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
        if (!res.ok) throw new Error("PDF extraction failed");

        const data = (await res.json()) as {
          extracted: Record<string, unknown>;
          found: string[];
          missing: string[];
        };

        mergeFields(data.extracted);

        const foundLabels = data.found
          .map((f) => FIELD_LABELS[f] ?? f)
          .join(", ");
        const missingLabels = data.missing
          .map((f) => FIELD_LABELS[f] ?? f)
          .join(", ");

        let botReply = "";
        if (data.found.length > 0) {
          botReply += `I extracted the following from your document: **${foundLabels}**.`;
        }
        if (data.missing.length > 0) {
          botReply += `\n\nI still need a few more details: ${missingLabels}. Let's go through them — `;
          // Ask about first missing field naturally
          const firstMissing = data.missing[0];
          const prompts: Record<string, string> = {
            companyName: "what's the name of your company?",
            problem: "what problem are you solving, and who are your target customers?",
            solution: "can you describe your solution or product?",
            technology: "what's your core technology and what makes it unique?",
            stage: "what stage is your company at?",
            teamSize: "how large is your team, and what are your key areas of expertise?",
            targetDepartments: "which Audi departments do you think would benefit most from working with you?",
          };
          botReply += prompts[firstMissing] ?? "can you tell me more?";
        } else {
          botReply += "\n\nGreat — all required information has been collected. You can now submit your application!";
        }

        setMessages((prev) => [...prev, { role: "assistant", content: botReply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I couldn't read that PDF — it may be encrypted or image-only. Could you describe your startup instead?",
          },
        ]);
      } finally {
        setIsPdfLoading(false);
      }
    },
    [isPdfLoading, mergeFields],
  );

  const handleSubmit = useCallback(async () => {
    if (!allRequiredFilled || isSubmitting) return;
    setIsSubmitting(true);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Submitting your application now — our AI is analysing your startup and matching it to the right Audi departments. This takes about 20–30 seconds…",
      },
    ]);

    const transcript = messages
      .filter((m) => !m.isPdf)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    try {
      const result = await submitApp({
        data: {
          companyName: collectedFields.companyName ?? "Unknown",
          website: collectedFields.website,
          stage: collectedFields.stage,
          teamSize: collectedFields.teamSize,
          transcript,
        },
      });
      setSubmitted(result);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong submitting your application. Please try again or reach out to startup@audi.de.",
        },
      ]);
      setIsSubmitting(false);
    }
  }, [allRequiredFilled, isSubmitting, messages, collectedFields, submitApp]);

  if (submitted) return <SuccessScreen result={submitted} />;

  const isBusy = isLoading || isPdfLoading || isSubmitting;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "linear-gradient(135deg, #0A0A14 0%, #0D0B1C 50%, #0A0A14 100%)" }}
    >
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.85)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .msg-in { animation: fadeUp 0.35s ease forwards; }
      `}</style>

      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,20,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Link href="/">
          <span className="flex items-center gap-3 cursor-pointer group">
            <img
              src="/audi-logo.png"
              alt="Audi"
              width={52}
              style={{ opacity: 0.75 }}
              className="group-hover:opacity-100 transition-opacity"
            />
            <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold group-hover:text-white/70 transition-colors">
              Innovation Hub
            </span>
          </span>
        </Link>
        <FieldProgress fields={REQUIRED_FIELDS} collected={collectedFields} />
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto pt-20 pb-40 px-4">
        <div className="space-y-4 py-8 max-w-2xl mx-auto w-full">
          {messages.map((msg, i) => (
            <div key={i} className={`msg-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && <BotAvatar />}
              <div
                className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "assistant" ? "rounded-tl-sm text-white/85" : "rounded-tr-sm text-white"
                }`}
                style={
                  msg.role === "assistant"
                    ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }
                    : msg.isPdf
                    ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }
                    : { background: AUDI_RED }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {(isLoading || isPdfLoading) && (
            <div className="msg-in flex justify-start">
              <BotAvatar />
              <TypingIndicator />
            </div>
          )}

          {/* Submit button — appears inline when all fields are ready */}
          {allRequiredFilled && !isSubmitting && (
            <div className="msg-in flex justify-center pt-2">
              <button
                onClick={handleSubmit}
                className="flex items-center gap-3 px-7 py-3.5 text-sm font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
                style={{ background: AUDI_RED }}
              >
                Submit Application
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      {!isSubmitting && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: "linear-gradient(to top, #0A0A14 60%, transparent)" }}
        >
          <div className="max-w-2xl mx-auto">
            <div
              className="flex items-center gap-2 p-1 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {/* PDF upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                title="Upload pitch deck (PDF)"
                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 4a2 2 0 012-2h5.586a1 1 0 01.707.293l3.414 3.414A1 1 0 0114 6.414V12a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M5.5 10h5M5.5 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfUpload(file);
                  e.target.value = "";
                }}
              />

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputValue.trim()) sendMessage(inputValue.trim());
                }}
                placeholder={isBusy ? "…" : "Ask a question or tell me about your startup"}
                disabled={isBusy}
                className="flex-1 bg-transparent px-2 py-3 text-sm text-white placeholder-white/20 outline-none"
              />

              {/* Send button */}
              <button
                onClick={() => { if (inputValue.trim()) sendMessage(inputValue.trim()); }}
                disabled={!inputValue.trim() || isBusy}
                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: AUDI_RED }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8h14M9 2l6 6-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <p className="text-center text-white/15 text-xs mt-2">
              PDF upload extracts pitch deck info automatically
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
