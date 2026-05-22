import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useSubmitApplication } from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";

const AUDI_RED = "#BB0A21";

const STEPS = [
  {
    id: "intro",
    question: "Welcome to the Audi Innovation Hub application. I'm here to learn about your startup. Let's start — what's your company name?",
    placeholder: "Enter your company name",
    field: "companyName",
    chips: [],
  },
  {
    id: "website",
    question: "Great! What's your company website or LinkedIn?",
    placeholder: "https://yourcompany.com",
    field: "website",
    chips: ["Skip for now"],
  },
  {
    id: "problem",
    question: "What problem are you solving, and who are your target customers?",
    placeholder: "We help automotive OEMs reduce...",
    field: "problem",
    chips: [],
  },
  {
    id: "technology",
    question: "Describe your core technology or product. What makes it unique?",
    placeholder: "Our proprietary AI model...",
    field: "technology",
    chips: [],
  },
  {
    id: "stage",
    question: "What stage is your company at?",
    placeholder: "Describe your stage",
    field: "stage",
    chips: ["Pre-seed / Idea", "Seed", "Series A", "Series B+", "Revenue-generating", "MVP / Beta"],
  },
  {
    id: "team",
    question: "How large is your team, and what are your key areas of expertise?",
    placeholder: "5 people — 2 engineers, 1 designer...",
    field: "teamSize",
    chips: ["1–5 people", "6–15 people", "16–50 people", "50+ people"],
  },
  {
    id: "collaboration",
    question: "How do you see collaborating with Audi? Which departments do you think could benefit most?",
    placeholder: "We'd love to work with R&D and Production on...",
    field: "collaboration",
    chips: ["Production & Manufacturing", "Research & Development", "Design Studio", "Logistics & Supply Chain", "Sales & Customer Experience", "Digital & IT"],
  },
  {
    id: "pitchdeck",
    question: "Last step — do you have a pitch deck or additional materials you'd like to share? (URL or skip)",
    placeholder: "https://pitch.com/deck or skip",
    field: "pitchDeck",
    chips: ["Skip for now"],
  },
];

interface Message {
  role: "assistant" | "user";
  content: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl rounded-tl-sm w-fit"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full inline-block"
          style={{
            background: "rgba(255,255,255,0.4)",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
      ))}
    </div>
  );
}

function SuccessScreen({ result }: { result: Application }) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const scores = (result.departmentScores ?? []) as Array<{ departmentId: string; departmentName: string; score: number; justification: string }>;
  const topDepts = [...scores].sort((a, b) => b.score - a.score).slice(0, 3);

  const base = typeof window !== "undefined" ? window.location.origin + (import.meta.env.BASE_URL?.replace(/\/$/, "") || "") : "";
  const trackingUrl = result.trackingToken ? `${base}/track/${result.trackingToken}` : null;

  const handleCopy = () => {
    if (!trackingUrl) return;
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20"
      style={{ background: "linear-gradient(135deg, #0A0A14 0%, #0D0B1C 50%, #0A0A14 100%)" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="max-w-2xl w-full text-center" style={{ animation: "fadeUp 0.6s ease forwards" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ background: "rgba(187,10,33,0.15)", border: "1.5px solid #BB0A21" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 14.5L11 20.5L23 8" stroke="#BB0A21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-4" style={{ color: AUDI_RED }}>Application Received</p>
        <h1 className="text-3xl md:text-4xl font-light text-white leading-tight mb-4">
          Thank you, <span className="font-semibold">{result.companyName}.</span>
        </h1>
        <p className="text-white/50 text-base leading-relaxed mb-8 max-w-lg mx-auto">
          Our team has analysed your application and identified the departments most relevant to your technology.
        </p>

        {trackingUrl && (
          <div className="mb-10 p-5 rounded-sm text-left"
            style={{ background: "rgba(187,10,33,0.06)", border: "1px solid rgba(187,10,33,0.2)" }}>
            <p className="text-xs tracking-[0.15em] uppercase font-semibold mb-2" style={{ color: AUDI_RED }}>Your tracking link</p>
            <p className="text-white/40 text-xs mb-3 leading-relaxed">
              Bookmark this link to check your application status at any time. No login required.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-sm"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-white/50 text-xs flex-1 truncate font-mono">{trackingUrl}</p>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={copied
                  ? { background: "rgba(80,200,100,0.15)", color: "rgba(80,200,100,0.9)", border: "1px solid rgba(80,200,100,0.3)" }
                  : { background: "rgba(187,10,33,0.15)", color: AUDI_RED, border: `1px solid rgba(187,10,33,0.3)` }}>
                {copied ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M1.5 5.5L4 8L9.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <rect x="3.5" y="3.5" width="6" height="6" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M2.5 7.5H2a0.8 0.8 0 01-.8-.8V2a0.8 0.8 0 01.8-.8h4.8a0.8 0.8 0 01.8.8v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {topDepts.length > 0 && (
          <div className="mb-12">
            <p className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold mb-6">Top department matches</p>
            <div className="space-y-3">
              {topDepts.map((d) => (
                <div key={d.departmentId}
                  className="flex items-center gap-4 p-4 rounded-sm text-left"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
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
            style={{ background: AUDI_RED }}>
            View Full Analysis →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Apply() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Application | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: submitApp } = useSubmitApplication();

  useEffect(() => {
    setIsTyping(true);
    const t = setTimeout(() => {
      setIsTyping(false);
      setMessages([{ role: "assistant", content: STEPS[0].question }]);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isTyping && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [isTyping, isSubmitting, currentStep]);

  const handleAnswer = async (answer: string) => {
    if (!answer.trim() || isTyping || isSubmitting) return;

    const step = STEPS[currentStep];
    const newAnswers = { ...answers, [step.field]: answer };
    setAnswers(newAnswers);
    setMessages((prev) => [...prev, { role: "user", content: answer }]);
    setInputValue("");

    const nextStep = currentStep + 1;

    if (nextStep >= STEPS.length) {
      setIsSubmitting(true);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Perfect — I have everything I need. Let me analyse your application and match it to the right Audi departments. This usually takes around 20–30 seconds…",
        }]);
      }, 600);

      const transcript = STEPS.map((s, i) => [
        { role: "assistant" as const, content: s.question },
        { role: "user" as const, content: newAnswers[s.field] ?? "" },
      ]).flat().filter((m) => m.content);

      try {
        const result = await submitApp({
          data: {
            companyName: newAnswers.companyName ?? "",
            website: newAnswers.website !== "Skip for now" ? newAnswers.website : undefined,
            stage: newAnswers.stage,
            teamSize: newAnswers.teamSize,
            transcript,
          },
        });
        setSubmitted(result);
      } catch {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Something went wrong submitting your application. Please try again or reach out to startup@audi.de.",
        }]);
        setIsSubmitting(false);
      }
      return;
    }

    setCurrentStep(nextStep);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: "assistant", content: STEPS[nextStep].question }]);
    }, 700 + Math.random() * 400);
  };

  const progress = Math.round((currentStep / STEPS.length) * 100);

  if (submitted) {
    return <SuccessScreen result={submitted} />;
  }

  const step = STEPS[Math.min(currentStep, STEPS.length - 1)];

  return (
    <div className="fixed inset-0 flex flex-col"
      style={{ background: "linear-gradient(135deg, #0A0A14 0%, #0D0B1C 50%, #0A0A14 100%)" }}>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .msg-in { animation: fadeUp 0.35s ease forwards; }
      `}</style>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: AUDI_RED }} />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,10,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/">
          <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold hover:text-white/70 transition-colors cursor-pointer">
            ← Audi Innovation Hub
          </span>
        </Link>
        <span className="text-white/20 text-xs font-mono">
          {currentStep + 1} / {STEPS.length}
        </span>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto pt-20 pb-36 px-4">
        <div className="space-y-4 py-8 max-w-2xl mx-auto w-full">
          {messages.map((msg, i) => (
            <div key={i}
              className={`msg-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 mt-0.5"
                  style={{ background: AUDI_RED }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                    <circle cx="6" cy="6" r="5" stroke="white" strokeWidth="1.5" fill="none" />
                    <path d="M4 6h4M6 4v4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "rounded-tl-sm text-white/85"
                    : "rounded-tr-sm text-white"
                }`}
                style={msg.role === "assistant"
                  ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }
                  : { background: AUDI_RED }}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="msg-in flex justify-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-3 mt-0.5"
                style={{ background: AUDI_RED }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                  <circle cx="6" cy="6" r="5" stroke="white" strokeWidth="1.5" fill="none" />
                  <path d="M4 6h4M6 4v4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <TypingIndicator />
            </div>
          )}

          {isSubmitting && !isTyping && (
            <div className="flex justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: `${AUDI_RED} transparent transparent transparent` }} />
                <p className="text-white/30 text-xs">Analysing your application…</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      {!isSubmitting && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: "linear-gradient(to top, #0A0A14 60%, transparent)" }}>
          <div className="max-w-2xl mx-auto">
            {/* Chips */}
            {step.chips.length > 0 && !isTyping && (
              <div className="flex flex-wrap gap-2 mb-3">
                {step.chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleAnswer(chip)}
                    className="px-3.5 py-1.5 text-xs font-medium text-white/60 rounded-full border border-white/10 hover:border-white/25 hover:text-white/90 transition-all">
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Input row */}
            <div className="flex items-center gap-3 p-1 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && inputValue.trim()) handleAnswer(inputValue.trim()); }}
                placeholder={isTyping ? "…" : step.placeholder}
                disabled={isTyping}
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
              />
              <button
                onClick={() => { if (inputValue.trim()) handleAnswer(inputValue.trim()); }}
                disabled={!inputValue.trim() || isTyping}
                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: AUDI_RED }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8h14M9 2l6 6-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
