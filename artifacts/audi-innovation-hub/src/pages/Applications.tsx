import { useState } from "react";
import { Link, useParams } from "wouter";
import { useListApplications, useGetApplication } from "@workspace/api-client-react";
import type { ApplicationSummary, DepartmentScore, BusinessCase } from "@workspace/api-client-react";

const AUDI_RED = "#BB0A21";

function StatusBadge({ status }: { status: string }) {
  const color = status === "routed" ? "#16a34a" : status === "archived" ? "#6b7280" : "#d97706";
  const label = status === "routed" ? "Analysed" : status === "archived" ? "Archived" : "Pending";
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            background: score >= 70 ? AUDI_RED : score >= 40 ? "#d97706" : "rgba(255,255,255,0.2)",
          }} />
      </div>
      <span className="text-sm font-semibold text-white/70 w-8 text-right">{score}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
      style={{
        background: copied ? "rgba(22,163,74,0.2)" : "rgba(255,255,255,0.08)",
        color: copied ? "#16a34a" : "rgba(255,255,255,0.5)",
        border: `1px solid ${copied ? "rgba(22,163,74,0.3)" : "rgba(255,255,255,0.1)"}`,
      }}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ApplicationCard({ app }: { app: ApplicationSummary }) {
  const scores = (app.departmentScores ?? []) as DepartmentScore[];
  const top2 = [...scores].sort((a, b) => b.score - a.score).slice(0, 2);

  return (
    <Link href={`/applications/${app.id}`}>
      <div
        className="group p-6 rounded-sm cursor-pointer transition-all hover:border-white/15"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">{app.companyName}</h2>
            <div className="flex items-center gap-3 mt-1">
              {app.stage && <span className="text-white/35 text-xs">{app.stage}</span>}
              {app.website && (
                <a
                  href={app.website}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-white/30 text-xs hover:text-white/60 transition-colors underline underline-offset-2">
                  {app.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge status={app.status} />
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              className="text-white/20 group-hover:text-white/50 transition-colors">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {top2.length > 0 && (
          <div className="space-y-2">
            {top2.map((d) => (
              <div key={d.departmentId} className="flex items-center gap-3">
                <span className="text-white/40 text-xs w-40 flex-shrink-0 truncate">{d.departmentName}</span>
                <ScoreBar score={d.score} />
              </div>
            ))}
          </div>
        )}

        <p className="text-white/20 text-xs mt-4">
          {new Date(app.createdAt).toLocaleDateString("de-DE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </Link>
  );
}

export function ApplicationsList() {
  const { data: apps, isLoading, error } = useListApplications();

  return (
    <div className="min-h-screen" style={{ background: "#0A0A14" }}>
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,20,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
        <Link href="/">
          <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold hover:text-white/70 transition-colors cursor-pointer">
            ← Audi Innovation Hub
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/departments">
            <button
              className="px-4 py-2 text-xs font-semibold rounded-sm transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
              Department Portal
            </button>
          </Link>
          <Link href="/apply">
            <button
              className="px-4 py-2 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
              style={{ background: AUDI_RED }}>
              New Application
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-4" style={{ color: AUDI_RED }}>
          Department View
        </p>
        <h1 className="text-3xl md:text-4xl font-light text-white mb-2">
          Startup <span className="font-semibold">Applications</span>
        </h1>
        <p className="text-white/35 text-sm mb-12">
          AI-analysed submissions with department routing scores.
        </p>

        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: `${AUDI_RED} transparent transparent transparent` }} />
          </div>
        )}

        {error && (
          <div
            className="p-6 rounded-sm text-red-400 text-sm"
            style={{ background: "rgba(187,10,33,0.1)", border: "1px solid rgba(187,10,33,0.2)" }}>
            Failed to load applications. Is the API server running?
          </div>
        )}

        {apps && apps.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/30 text-sm mb-6">No applications yet.</p>
            <Link href="/apply">
              <button
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-sm"
                style={{ background: AUDI_RED }}>
                Submit the first application
              </button>
            </Link>
          </div>
        )}

        {apps && apps.length > 0 && (
          <div className="space-y-4">
            {apps.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: app, isLoading, error } = useGetApplication(id ?? "");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A14" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: `${AUDI_RED} transparent transparent transparent` }} />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A14" }}>
        <div className="text-center">
          <p className="text-white/30 text-sm mb-4">Application not found.</p>
          <Link href="/applications">
            <button className="text-white/40 text-xs underline">← Back to list</button>
          </Link>
        </div>
      </div>
    );
  }

  const scores = (app.departmentScores ?? []) as DepartmentScore[];
  const cases = (app.businessCases ?? []) as BusinessCase[];
  const structured = app.structuredData as Record<string, string> | null;
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen" style={{ background: "#0A0A14" }}>
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,20,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
        <Link href="/applications">
          <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold hover:text-white/70 transition-colors cursor-pointer">
            ← All Applications
          </span>
        </Link>
        <StatusBadge status={app.status} />
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20 space-y-12">

        {/* Header */}
        <div>
          <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-3" style={{ color: AUDI_RED }}>
            Startup Profile
          </p>
          <h1 className="text-3xl md:text-4xl font-light text-white mb-1">
            <span className="font-semibold">{app.companyName}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            {app.stage && <span className="text-white/40 text-sm">{app.stage}</span>}
            {app.teamSize && <span className="text-white/40 text-sm">· {app.teamSize}</span>}
            {app.website && (
              <a
                href={app.website}
                target="_blank"
                rel="noreferrer"
                className="text-white/40 text-sm hover:text-white/70 transition-colors underline underline-offset-2">
                {app.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        {/* Structured data */}
        {structured && (
          <div
            className="p-6 rounded-sm"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold mb-5">
              AI Extracted Profile
            </p>
            {[
              { label: "Problem Statement", key: "problemStatement" },
              { label: "Solution", key: "solution" },
              { label: "Technology", key: "technology" },
              { label: "Traction", key: "traction" },
              { label: "Target Collaboration", key: "targetCollaboration" },
            ].map(({ label, key }) =>
              structured[key] ? (
                <div
                  key={key}
                  className="grid grid-cols-3 gap-4 py-3 border-b border-white/5 last:border-0">
                  <p className="text-white/30 text-xs font-semibold uppercase tracking-wide col-span-1">
                    {label}
                  </p>
                  <p className="text-white/75 text-sm leading-relaxed col-span-2">{structured[key]}</p>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Department scores */}
        {sortedScores.length > 0 && (
          <div>
            <p className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold mb-6">
              Department Relevance Scores
            </p>
            <div className="space-y-4">
              {sortedScores.map((d) => (
                <div
                  key={d.departmentId}
                  className="p-4 rounded-sm"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white text-sm font-medium">{d.departmentName}</p>
                    <p className="text-lg font-semibold" style={{ color: AUDI_RED }}>
                      {d.score}
                      <span className="text-white/20 text-xs font-normal">/100</span>
                    </p>
                  </div>
                  <ScoreBar score={d.score} />
                  {d.justification && (
                    <p className="text-white/35 text-xs mt-2 leading-relaxed">{d.justification}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business cases */}
        {cases.length > 0 && (
          <div>
            <p className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold mb-6">
              AI-Generated Business Cases
            </p>
            <div className="space-y-6">
              {cases.map((bc) => (
                <div
                  key={bc.departmentId}
                  className="p-6 rounded-sm"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: AUDI_RED }} />
                      <p className="text-white font-semibold text-sm">{bc.departmentName}</p>
                    </div>
                    <CopyButton text={bc.brief} />
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{bc.brief}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {cases.length === 0 && scores.length === 0 && (
          <div
            className="p-6 rounded-sm text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-white/30 text-sm">AI analysis is still processing or was not completed.</p>
          </div>
        )}
      </div>
    </div>
  );
}
