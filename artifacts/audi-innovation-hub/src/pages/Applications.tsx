import { useState, useCallback } from "react";
import { Link, useParams } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import { UserButton } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListApplications,
  useGetApplication,
  useUpdateApplication,
  getListApplicationsQueryKey,
  getGetApplicationQueryKey,
} from "@workspace/api-client-react";
import type {
  ApplicationSummary,
  DepartmentScore,
  BusinessCase,
  RequirementItem,
  MilestoneItem,
  KpiItem,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";

const AUDI_RED = "#BB0A21";

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pending",     color: "#d97706", bg: "rgba(217,119,6,0.12)"   },
  routed:      { label: "Analysed",    color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  shortlisted: { label: "Shortlisted", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  accepted:    { label: "Accepted",    color: "#16a34a", bg: "rgba(22,163,74,0.12)"   },
  declined:    { label: "Declined",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  archived:    { label: "Archived",    color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Star rating (display only) ───────────────────────────────────────────────
function StarDisplay({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-white/20 text-xs">—</span>;
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill={i <= rating ? AUDI_RED : "none"}>
          <path d="M6 1l1.4 2.9 3.1.4-2.2 2.2.5 3.1L6 8.1 3.2 9.6l.5-3.1L1.5 4.3l3.1-.4z"
            stroke={i <= rating ? AUDI_RED : "rgba(255,255,255,0.2)"} strokeWidth="0.8" />
        </svg>
      ))}
    </span>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            background: score >= 70 ? AUDI_RED : score >= 40 ? "#d97706" : "rgba(255,255,255,0.2)",
          }} />
      </div>
      <span className="text-xs font-semibold text-white/50 w-7 text-right tabular-nums">{score}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (ApplicationsList)
// ═══════════════════════════════════════════════════════════════════════════════
export function ApplicationsList() {
  const { data: apps, isLoading, error } = useListApplications();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const stats = {
    total:       apps?.length ?? 0,
    pending:     apps?.filter(a => a.status === "pending" || a.status === "routed").length ?? 0,
    shortlisted: apps?.filter(a => a.status === "shortlisted").length ?? 0,
    accepted:    apps?.filter(a => a.status === "accepted").length ?? 0,
    declined:    apps?.filter(a => a.status === "declined").length ?? 0,
  };

  const filtered = (apps ?? []).filter(a => {
    const matchFilter = filter === "all" || a.status === filter ||
      (filter === "pending" && (a.status === "pending" || a.status === "routed"));
    const matchSearch = !search ||
      a.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (a.stage ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="min-h-screen" style={{ background: "#0A0A14" }}>
      {/* Nav */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,20,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Link href="/">
          <span className="flex items-center gap-3 cursor-pointer group">
            <img src="/audi-logo.png" alt="Audi" className="h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold group-hover:text-white/70 transition-colors">
              Innovation Hub
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/departments">
            <button className="px-4 py-2 text-xs font-semibold rounded-sm transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Departments
            </button>
          </Link>
          <Link href="/apply">
            <button className="px-4 py-2 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
              style={{ background: AUDI_RED }}>
              + New Application
            </button>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-2" style={{ color: AUDI_RED }}>
            Staff Dashboard
          </p>
          <h1 className="text-3xl md:text-4xl font-light text-white">
            Startup <span className="font-semibold">Applications</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Review, rate, and move applications through the pipeline.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total",       value: stats.total,       filter: "all",         color: "rgba(255,255,255,0.6)" },
            { label: "Pending",     value: stats.pending,     filter: "pending",     color: "#d97706"  },
            { label: "Shortlisted", value: stats.shortlisted, filter: "shortlisted", color: "#8b5cf6"  },
            { label: "Accepted",    value: stats.accepted,    filter: "accepted",    color: "#16a34a"  },
            { label: "Declined",    value: stats.declined,    filter: "declined",    color: "#6b7280"  },
          ].map(({ label, value, filter: f, color }) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="p-4 rounded-sm text-left transition-all"
              style={{
                background: filter === f ? "rgba(187,10,33,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${filter === f ? `${AUDI_RED}44` : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
              <p className="text-white/35 text-xs mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Search + filter tabs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company or stage…"
            className="flex-1 px-4 py-2.5 rounded-sm text-sm text-white placeholder-white/25 outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          />
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "shortlisted", "accepted", "declined", "archived"].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3 py-2 text-xs font-semibold rounded-sm capitalize transition-all"
                style={{
                  background: filter === s ? AUDI_RED : "rgba(255,255,255,0.05)",
                  color: filter === s ? "#fff" : "rgba(255,255,255,0.45)",
                  border: `1px solid ${filter === s ? AUDI_RED : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: `${AUDI_RED} transparent transparent transparent` }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 rounded-sm text-red-400 text-sm"
            style={{ background: "rgba(187,10,33,0.1)", border: "1px solid rgba(187,10,33,0.2)" }}>
            Failed to load applications. Is the API server running?
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/25 text-sm mb-6">
              {search ? "No applications match your search." : "No applications yet."}
            </p>
            <Link href="/apply">
              <button className="px-5 py-2.5 text-sm font-semibold text-white rounded-sm"
                style={{ background: AUDI_RED }}>
                Submit the first application
              </button>
            </Link>
          </div>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="rounded-sm overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold tracking-[0.12em] uppercase text-white/25"
              style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="col-span-4">Company</span>
              <span className="col-span-2 hidden md:block">Stage</span>
              <span className="col-span-2 hidden md:block">Top Score</span>
              <span className="col-span-1">Rating</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-1 text-right">Date</span>
            </div>
            {/* Rows */}
            {filtered.map((app, i) => (
              <AppRow key={app.id} app={app} odd={i % 2 === 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AppRow({ app, odd }: { app: ApplicationSummary; odd: boolean }) {
  const scores = (app.departmentScores ?? []) as DepartmentScore[];
  const topScore = scores.length > 0 ? Math.max(...scores.map(s => s.score)) : null;
  const topDept = topScore != null ? scores.find(s => s.score === topScore) : null;

  return (
    <Link href={`/applications/${app.id}`}>
      <div
        className="grid grid-cols-12 gap-4 px-5 py-4 cursor-pointer transition-all group items-center"
        style={{
          background: odd ? "rgba(255,255,255,0.015)" : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {/* Company */}
        <div className="col-span-4">
          <p className="text-white font-medium text-sm group-hover:text-white transition-colors truncate">
            {app.companyName}
          </p>
          {app.website && (
            <p className="text-white/25 text-xs truncate mt-0.5">
              {app.website.replace(/^https?:\/\//, "")}
            </p>
          )}
        </div>

        {/* Stage */}
        <div className="col-span-2 hidden md:block">
          <span className="text-white/40 text-xs">{app.stage ?? "—"}</span>
        </div>

        {/* Top score */}
        <div className="col-span-2 hidden md:block">
          {topDept ? (
            <div>
              <p className="text-white/35 text-xs truncate mb-1">{topDept.departmentName.split(" ")[0]}</p>
              <ScoreBar score={topDept.score} />
            </div>
          ) : (
            <span className="text-white/20 text-xs">Pending AI</span>
          )}
        </div>

        {/* Rating */}
        <div className="col-span-1">
          <StarDisplay rating={(app as any).rating} />
        </div>

        {/* Status */}
        <div className="col-span-2">
          <StatusBadge status={app.status} />
        </div>

        {/* Date */}
        <div className="col-span-1 text-right">
          <span className="text-white/20 text-xs">
            {new Date(app.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPLICATION DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { sessionClaims, isLoaded } = useAuth();
  const qc = useQueryClient();

  const { data: app, isLoading, error } = useGetApplication(id ?? "");
  const { mutate: patch } = useUpdateApplication({
    mutation: {
      onSuccess: (updated) => {
        qc.setQueryData(getGetApplicationQueryKey(id ?? ""), updated);
        qc.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
      },
    },
  });

  const meta = sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  const isStaff = isLoaded && meta?.["role"] === "audi_staff";

  const save = useCallback(
    (fields: Parameters<typeof patch>[0]["data"]) => {
      if (!id) return;
      patch({ id, data: fields });
    },
    [id, patch],
  );

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
      {/* Nav */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,20,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Link href="/applications">
          <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold hover:text-white/70 transition-colors cursor-pointer">
            ← Applications
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge status={app.status} />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20 space-y-10">

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
              <a href={app.website} target="_blank" rel="noreferrer"
                className="text-white/40 text-sm hover:text-white/70 transition-colors underline underline-offset-2">
                {app.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        {/* AI-extracted profile */}
        {structured && (
          <Section title="AI Extracted Profile">
            {[
              { label: "Problem Statement", key: "problemStatement" },
              { label: "Solution", key: "solution" },
              { label: "Technology", key: "technology" },
              { label: "Traction", key: "traction" },
              { label: "Target Collaboration", key: "targetCollaboration" },
            ].map(({ label, key }) =>
              structured[key] ? (
                <div key={key}
                  className="grid grid-cols-3 gap-4 py-3 border-b border-white/5 last:border-0">
                  <p className="text-white/30 text-xs font-semibold uppercase tracking-wide col-span-1">{label}</p>
                  <p className="text-white/75 text-sm leading-relaxed col-span-2">{structured[key]}</p>
                </div>
              ) : null
            )}
          </Section>
        )}

        {/* Department scores */}
        {sortedScores.length > 0 && (
          <div>
            <SectionLabel>Department Relevance Scores</SectionLabel>
            <div className="space-y-3">
              {sortedScores.map((d) => (
                <div key={d.departmentId} className="p-4 rounded-sm"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white text-sm font-medium">{d.departmentName}</p>
                    <p className="text-lg font-semibold" style={{ color: AUDI_RED }}>
                      {d.score}<span className="text-white/20 text-xs font-normal">/100</span>
                    </p>
                  </div>
                  <ScoreBar score={d.score} />
                  {d.justification && <p className="text-white/35 text-xs mt-2 leading-relaxed">{d.justification}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business cases */}
        {cases.length > 0 && (
          <div>
            <SectionLabel>AI-Generated Business Cases</SectionLabel>
            <div className="space-y-4">
              {cases.map((bc) => (
                <div key={bc.departmentId} className="p-6 rounded-sm"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center justify-between mb-3">
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

        {/* Staff actions panel — only for audi_staff */}
        {isStaff && (
          <StaffPanel app={app} onSave={save} />
        )}

        {!structured && cases.length === 0 && scores.length === 0 && (
          <div className="p-6 rounded-sm text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-white/30 text-sm">AI analysis is still processing or was not completed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small shared layout components ──────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold mb-5">{children}</p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-sm"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
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

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function StaffPanel({
  app,
  onSave,
}: {
  app: { status: string; rating?: number | null; notes?: string | null; nextStep?: string | null; requirements?: RequirementItem[] | null; milestones?: MilestoneItem[] | null; kpis?: KpiItem[] | null; assignedEmployee?: { name: string; role: string; email: string; department: string } | null; ndaStatus?: string | null };
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [status, setStatus] = useState(app.status);
  const [rating, setRating] = useState<number>(app.rating ?? 0);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [nextStep, setNextStep] = useState(app.nextStep ?? "");
  const [reqs, setReqs] = useState<RequirementItem[]>(app.requirements ?? []);
  const [milestones, setMilestones] = useState<MilestoneItem[]>(app.milestones ?? []);
  const [kpis, setKpis] = useState<KpiItem[]>(app.kpis ?? []);
  const [saved, setSaved] = useState(false);

  // Onboarding fields
  const [empName, setEmpName] = useState(app.assignedEmployee?.name ?? "");
  const [empRole, setEmpRole] = useState(app.assignedEmployee?.role ?? "");
  const [empEmail, setEmpEmail] = useState(app.assignedEmployee?.email ?? "");
  const [empDept, setEmpDept] = useState(app.assignedEmployee?.department ?? "");
  const [ndaStatus, setNdaStatus] = useState<string>(app.ndaStatus ?? "pending_signature");

  const triggerSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const handleSave = () => {
    const assignedEmployee = empName && empRole && empEmail && empDept
      ? { name: empName, role: empRole, email: empEmail, department: empDept }
      : null;
    onSave({ status, rating: rating || null, notes, nextStep, requirements: reqs, milestones, kpis, assignedEmployee, ndaStatus: ndaStatus || null });
    triggerSaved();
  };

  // Requirement helpers
  const addReq = () => setReqs(r => [...r, { id: crypto.randomUUID(), text: "", done: false }]);
  const updateReq = (id: string, text: string) => setReqs(r => r.map(x => x.id === id ? { ...x, text } : x));
  const toggleReq = (id: string) => setReqs(r => r.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const removeReq = (id: string) => setReqs(r => r.filter(x => x.id !== id));

  // Milestone helpers
  const addMs = () => setMilestones(m => [...m, { id: crypto.randomUUID(), title: "", dueDate: "", status: "pending" }]);
  const updateMs = (id: string, patch: Partial<MilestoneItem>) =>
    setMilestones(m => m.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeMs = (id: string) => setMilestones(m => m.filter(x => x.id !== id));

  // KPI helpers
  const addKpi = () => setKpis(k => [...k, { id: crypto.randomUUID(), metric: "", target: "", current: "", unit: "" }]);
  const updateKpi = (id: string, patch: Partial<KpiItem>) =>
    setKpis(k => k.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeKpi = (id: string) => setKpis(k => k.filter(x => x.id !== id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.25em] font-semibold uppercase" style={{ color: AUDI_RED }}>Staff Actions</p>
          <p className="text-white/30 text-xs mt-0.5">Internal assessment — not visible to applicant</p>
        </div>
        <button
          onClick={handleSave}
          className="px-5 py-2 text-sm font-semibold text-white rounded-sm transition-all"
          style={{ background: saved ? "#16a34a" : AUDI_RED }}
        >
          {saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>

      {/* Row 1: Status + Rating */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">Pipeline Status</p>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-sm text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <option value="pending">Pending</option>
            <option value="routed">Analysed</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="p-5 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">Overall Rating</p>
          <div className="flex gap-2 mt-1">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => setRating(r => r === n ? 0 : n)}
                className="transition-transform hover:scale-110"
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill={n <= rating ? AUDI_RED : "none"}>
                  <path d="M14 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L14 17.3l-5.6 3 1.1-6.2L5 9.6l6.2-.9z"
                    stroke={n <= rating ? AUDI_RED : "rgba(255,255,255,0.2)"} strokeWidth="1.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding — only shown when accepted */}
      {status === "accepted" && (
        <div className="rounded-sm overflow-hidden" style={{ border: "1px solid rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.04)" }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(22,163,74,0.12)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
            <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>Onboarding Bundle — visible to applicant</p>
          </div>
          <div className="p-5 space-y-4">
            {/* NDA Status */}
            <div>
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-2">NDA Status</p>
              <div className="flex gap-2">
                {["pending_signature", "signed"].map(val => (
                  <button
                    key={val}
                    onClick={() => setNdaStatus(val)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-all"
                    style={{
                      background: ndaStatus === val ? (val === "signed" ? "rgba(22,163,74,0.2)" : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.03)",
                      color: ndaStatus === val ? (val === "signed" ? "#16a34a" : "rgba(255,255,255,0.7)") : "rgba(255,255,255,0.3)",
                      border: `1px solid ${ndaStatus === val ? (val === "signed" ? "rgba(22,163,74,0.3)" : "rgba(255,255,255,0.15)") : "rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    {val === "signed" ? "✓ Signed" : "Pending signature"}
                  </button>
                ))}
              </div>
            </div>
            {/* Assigned Employee */}
            <div>
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">Assigned Audi Employee</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Full name", value: empName, setter: setEmpName, placeholder: "e.g. Anna Müller" },
                  { label: "Role / Title", value: empRole, setter: setEmpRole, placeholder: "e.g. Innovation Manager" },
                  { label: "Email", value: empEmail, setter: setEmpEmail, placeholder: "e.g. a.mueller@audi.de" },
                  { label: "Department", value: empDept, setter: setEmpDept, placeholder: "e.g. R&D Partnerships" },
                ].map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wide mb-1">{label}</p>
                    <input
                      value={value}
                      onChange={e => setter(e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-sm text-sm text-white placeholder-white/20 outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                    />
                  </div>
                ))}
              </div>
              {(empName || empEmail) && (
                <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-sm" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "rgba(187,10,33,0.15)", color: AUDI_RED }}>
                    {empName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">{empName || "—"}</p>
                    <p className="text-white/35 text-[10px]">{empRole || "—"} · {empDept || "—"}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="p-5 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">Internal Notes</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Add internal notes about this startup…"
          className="w-full px-3 py-2.5 rounded-sm text-sm text-white placeholder-white/20 outline-none resize-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
        />
      </div>

      {/* Next Step */}
      <div className="p-5 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">Next Step</p>
        <input
          value={nextStep}
          onChange={e => setNextStep(e.target.value)}
          placeholder="e.g. Schedule discovery call with R&D team"
          className="w-full px-3 py-2.5 rounded-sm text-sm text-white placeholder-white/20 outline-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
        />
      </div>

      {/* Requirements */}
      <div className="p-5 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wide">Requirements</p>
          <button onClick={addReq}
            className="px-3 py-1 text-xs font-semibold rounded-sm transition-all"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            + Add
          </button>
        </div>
        {reqs.length === 0 && <p className="text-white/20 text-xs">No requirements defined yet.</p>}
        <div className="space-y-2">
          {reqs.map(req => (
            <div key={req.id} className="flex items-center gap-3">
              <button onClick={() => toggleReq(req.id)} className="flex-shrink-0">
                <div className="w-4 h-4 rounded-sm flex items-center justify-center transition-all"
                  style={{ background: req.done ? AUDI_RED : "transparent", border: `1.5px solid ${req.done ? AUDI_RED : "rgba(255,255,255,0.2)"}` }}>
                  {req.done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </button>
              <input
                value={req.text}
                onChange={e => updateReq(req.id, e.target.value)}
                placeholder="Requirement…"
                className="flex-1 px-2.5 py-1.5 rounded text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  color: req.done ? "rgba(255,255,255,0.3)" : "#fff",
                  textDecoration: req.done ? "line-through" : "none",
                }}
              />
              <button onClick={() => removeReq(req.id)}
                className="text-white/20 hover:text-white/60 transition-colors text-lg leading-none flex-shrink-0">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div className="p-5 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wide">Milestones</p>
          <button onClick={addMs}
            className="px-3 py-1 text-xs font-semibold rounded-sm transition-all"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            + Add
          </button>
        </div>
        {milestones.length === 0 && <p className="text-white/20 text-xs">No milestones defined yet.</p>}
        <div className="space-y-3">
          {milestones.map((ms, i) => (
            <div key={ms.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1 flex justify-center">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: ms.status === "done" ? "#16a34a22" : ms.status === "in_progress" ? `${AUDI_RED}22` : "rgba(255,255,255,0.06)", color: ms.status === "done" ? "#16a34a" : ms.status === "in_progress" ? AUDI_RED : "rgba(255,255,255,0.3)" }}>
                  {i + 1}
                </div>
              </div>
              <input value={ms.title} onChange={e => updateMs(ms.id, { title: e.target.value })}
                placeholder="Milestone title…"
                className="col-span-5 px-2.5 py-1.5 rounded text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
              <input type="date" value={ms.dueDate ?? ""} onChange={e => updateMs(ms.id, { dueDate: e.target.value })}
                className="col-span-3 px-2.5 py-1.5 rounded text-xs text-white/60 outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", colorScheme: "dark" }} />
              <select value={ms.status} onChange={e => updateMs(ms.id, { status: e.target.value as MilestoneItem["status"] })}
                className="col-span-2 px-2 py-1.5 rounded text-xs text-white/70 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <button onClick={() => removeMs(ms.id)}
                className="col-span-1 text-white/20 hover:text-white/60 transition-colors text-lg leading-none text-center">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="p-5 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wide">KPIs</p>
          <button onClick={addKpi}
            className="px-3 py-1 text-xs font-semibold rounded-sm transition-all"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            + Add KPI
          </button>
        </div>
        {kpis.length === 0 && <p className="text-white/20 text-xs">No KPIs defined yet.</p>}

        {kpis.length > 0 && (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs text-white/20 font-semibold uppercase tracking-wide px-1 pb-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="col-span-4">Metric</span>
              <span className="col-span-3">Target</span>
              <span className="col-span-3">Current</span>
              <span className="col-span-2">Unit</span>
            </div>
            {kpis.map(kpi => (
              <div key={kpi.id} className="grid grid-cols-12 gap-2 items-center">
                <input value={kpi.metric} onChange={e => updateKpi(kpi.id, { metric: e.target.value })}
                  placeholder="e.g. Revenue growth"
                  className="col-span-4 px-2.5 py-1.5 rounded text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
                <input value={kpi.target} onChange={e => updateKpi(kpi.id, { target: e.target.value })}
                  placeholder="Target"
                  className="col-span-3 px-2.5 py-1.5 rounded text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
                <input value={kpi.current} onChange={e => updateKpi(kpi.id, { current: e.target.value })}
                  placeholder="Current"
                  className="col-span-3 px-2.5 py-1.5 rounded text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
                <input value={kpi.unit ?? ""} onChange={e => updateKpi(kpi.id, { unit: e.target.value })}
                  placeholder="%"
                  className="col-span-1 px-2 py-1.5 rounded text-sm text-white/60 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
                <button onClick={() => removeKpi(kpi.id)}
                  className="col-span-1 text-white/20 hover:text-white/60 transition-colors text-lg leading-none text-center">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button (bottom) */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          className="px-7 py-3 text-sm font-semibold text-white rounded-sm transition-all"
          style={{ background: saved ? "#16a34a" : AUDI_RED }}
        >
          {saved ? "✓ Changes Saved" : "Save All Changes"}
        </button>
      </div>
    </motion.div>
  );
}
