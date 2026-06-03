import { useState, useCallback, useEffect } from "react";
import { Link, useParams } from "wouter";
import { useAuth, useUser, UserButton } from "@clerk/clerk-react";
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
import { motion, AnimatePresence } from "framer-motion";

const AUDI_RED = "#BB0A21";

const DEPARTMENTS: Record<string, string> = {
  production: "Production & Manufacturing",
  rd:         "Research & Development",
  design:     "Design Studio",
  logistics:  "Logistics & Supply Chain",
  sales:      "Sales & Customer Experience",
  digital:    "Digital & IT",
};

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "In Analyse",         color: "#d97706", bg: "rgba(217,119,6,0.12)"   },
  analyzed: { label: "Analysiert",         color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  assigned: { label: "Zugewiesen",         color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  approved: { label: "Erstkontakt",        color: "#16a34a", bg: "rgba(22,163,74,0.12)"   },
  declined: { label: "Abgelehnt",          color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  archived: { label: "Archiviert",         color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
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
        <div className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${score}%`,
            background: score >= 70 ? AUDI_RED : score >= 40 ? "#d97706" : "rgba(255,255,255,0.2)",
          }} />
      </div>
      <span className="text-xs font-semibold text-white/50 w-7 text-right tabular-nums">{score}</span>
    </div>
  );
}

// ─── Review Card ─────────────────────────────────────────────────────────────
function ReviewCard({ app, deptScore, index }: { app: ApplicationSummary; deptScore: DepartmentScore; index: number }) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/applications/${app.id}/claim`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setClaimError(body.error ?? "Fehler beim Übernehmen");
        return;
      }
      qc.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
    } catch {
      setClaimError("Netzwerkfehler");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="flex items-center gap-5 px-5 py-4 rounded-sm"
      style={{
        background: "rgba(187,10,33,0.04)",
        border: "1px solid rgba(187,10,33,0.2)",
        borderLeft: `3px solid ${AUDI_RED}`,
      }}
    >
      {/* Company info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{app.companyName}</p>
        {app.website && (
          <p className="text-white/30 text-xs truncate mt-0.5">{app.website.replace(/^https?:\/\//, "")}</p>
        )}
        {deptScore.justification && (
          <p className="text-white/40 text-xs mt-1.5 leading-relaxed line-clamp-2">{deptScore.justification}</p>
        )}
      </div>

      {/* Score */}
      <div className="flex-shrink-0 text-center w-16">
        <p className="text-2xl font-light" style={{ color: AUDI_RED }}>{deptScore.score}</p>
        <p className="text-white/25 text-[9px] uppercase tracking-wide">/ 100</p>
        <div className="mt-1 h-1 rounded-full w-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full" style={{ width: `${deptScore.score}%`, background: AUDI_RED }} />
        </div>
      </div>

      {/* Status + CTAs */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <StatusBadge status={app.status} />
        {claimError && (
          <p className="text-[10px] text-red-400 text-right max-w-[140px] leading-snug">{claimError}</p>
        )}
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm text-white transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] disabled:opacity-50"
          style={{ background: AUDI_RED }}
        >
          {claiming ? (
            <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "white transparent transparent transparent" }} />
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v5M6 6l3-3M6 6l-3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 9.5h10" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Übernehmen
            </>
          )}
        </button>
        <Link href={`/applications/${app.id}`}>
          <button
            className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-opacity duration-150 hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            Details
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Ambassador Card ──────────────────────────────────────────────────────────
function AmbassadorCard({
  app,
  index,
  userId,
}: {
  app: ApplicationSummary;
  index: number;
  userId: string;
}) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { mutate: patch } = useUpdateApplication({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
      },
    },
  });
  const [declining, setDeclining] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  const handleApprove = async () => {
    setContactLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/applications/${app.id}/applicant-contact`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const { email, firstName } = await res.json() as { email: string; firstName: string };
        const subject = encodeURIComponent(`Erstkontakt — ${app.companyName} × Audi Innovation Hub`);
        const body = encodeURIComponent(
          `Hallo${firstName ? ` ${firstName}` : ""},\n\nvielen Dank für deine Bewerbung beim Audi Innovation Hub.\n\nIch bin dein persönlicher Startup Ambassador und freue mich, mit dir in Kontakt zu treten. Lass uns gemeinsam die nächsten Schritte besprechen.\n\nMit freundlichen Grüßen`
        );
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
      }
    } catch {
      // Proceed anyway — contact might not have a linked account
    } finally {
      setContactLoading(false);
    }
    patch({ id: app.id, data: { status: "approved" } as unknown as Parameters<typeof patch>[0]["data"] });
  };

  const handleDecline = () => {
    patch({ id: app.id, data: { status: "declined" } as unknown as Parameters<typeof patch>[0]["data"] });
    setDeclining(false);
  };

  const employee = app.assignedEmployee as { name?: string; department?: string } | null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="flex items-center gap-5 px-5 py-4 rounded-sm"
      style={{
        background: "rgba(139,92,246,0.04)",
        border: "1px solid rgba(139,92,246,0.2)",
        borderLeft: "3px solid #8b5cf6",
      }}
    >
      {/* Company info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{app.companyName}</p>
        {app.website && (
          <p className="text-white/30 text-xs truncate mt-0.5">{app.website.replace(/^https?:\/\//, "")}</p>
        )}
        <p className="text-white/40 text-xs mt-1">
          Du bist als Startup Ambassador zugewiesen
          {employee?.department ? ` · ${employee.department}` : ""}
        </p>
      </div>

      {/* Status */}
      <StatusBadge status={app.status} />

      {/* Action buttons */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        {declining ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-white/40">Wirklich ablehnen?</p>
            <button
              onClick={handleDecline}
              className="px-3 py-1.5 text-xs font-semibold rounded-sm text-white"
              style={{ background: "#6b7280" }}
            >
              Ja, ablehnen
            </button>
            <button
              onClick={() => setDeclining(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-sm"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeclining(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
              style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              Ablehnen
            </button>
            <button
              onClick={handleApprove}
              disabled={contactLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm text-white transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] disabled:opacity-50"
              style={{ background: "#16a34a" }}
            >
              {contactLoading ? (
                <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "white transparent transparent transparent" }} />
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 8.5c0-1.5 2-2.5 5-2.5s5 1 5 2.5M6 5.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
              Erstkontakt herstellen
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (ApplicationsList)
// ═══════════════════════════════════════════════════════════════════════════════
export function ApplicationsList() {
  const { data: apps, isLoading, error, refetch } = useListApplications();
  const { user } = useUser();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  type SortField = "company" | "stage" | "score" | "rating" | "status" | "date";
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const handleSort = (field: SortField) => {
    if (sortField === field) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setSortField(field); setSortDir("desc"); }
  };

  // Poll every 30 s so new applications appear without a manual reload
  useEffect(() => {
    const id = setInterval(() => { refetch(); }, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  const userRole = (user?.publicMetadata?.role as string | undefined) ?? null;
  const userDeptId = (user?.publicMetadata?.departmentId as string | undefined) ?? null;
  const userDeptName = userDeptId ? (DEPARTMENTS[userDeptId] ?? userDeptId) : null;
  const isStaffView = userRole === "audi_staff";

  // Review queue: dept score ≥ 70, status analyzed, not yet rated
  const reviewQueue = isStaffView && userDeptId
    ? (apps ?? []).filter(a => {
        if (a.status !== "analyzed") return false;
        if ((a as any).rating) return false;
        return ((a.departmentScores ?? []) as DepartmentScore[])
          .some(s => s.departmentId === userDeptId && s.score >= 70);
      })
    : [];

  const reviewedCount = isStaffView && userDeptId
    ? (apps ?? []).filter(a =>
        (a as any).rating > 0 &&
        ((a.departmentScores ?? []) as DepartmentScore[]).some(s => s.departmentId === userDeptId && s.score >= 70)
      ).length
    : 0;

  const assignedCount = isStaffView
    ? (apps ?? []).filter(a => (a.assignedEmployee as any)?.clerkId === user?.id).length
    : 0;

  // Apps assigned to this staff member as ambassador
  const ambassadorApps = isStaffView
    ? (apps ?? []).filter(a => (a.assignedEmployee as any)?.clerkId === user?.id && a.status === "assigned")
    : [];

  const stats = {
    total:    apps?.length ?? 0,
    analyzed: apps?.filter(a => a.status === "pending" || a.status === "analyzed").length ?? 0,
    assigned: apps?.filter(a => a.status === "assigned").length ?? 0,
    approved: apps?.filter(a => a.status === "approved").length ?? 0,
    declined: apps?.filter(a => a.status === "declined").length ?? 0,
  };

  const filtered = (apps ?? []).filter(a => {
    const matchFilter = filter === "all" || a.status === filter ||
      (filter === "analyzed" && (a.status === "pending" || a.status === "analyzed"));
    const matchSearch = !search ||
      a.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (a.stage ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const STATUS_ORDER: Record<string, number> = {
    pending: 0, analyzed: 1, assigned: 2, approved: 3, declined: 4, archived: 5,
  };
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "company": cmp = a.companyName.localeCompare(b.companyName); break;
      case "stage":   cmp = (a.stage ?? "").localeCompare(b.stage ?? ""); break;
      case "score": {
        const aMax = (a.departmentScores?.length ?? 0) > 0
          ? Math.max(...(a.departmentScores as DepartmentScore[]).map(s => s.score)) : -1;
        const bMax = (b.departmentScores?.length ?? 0) > 0
          ? Math.max(...(b.departmentScores as DepartmentScore[]).map(s => s.score)) : -1;
        cmp = aMax - bMax; break;
      }
      case "rating":  cmp = ((a as any).rating ?? 0) - ((b as any).rating ?? 0); break;
      case "status":  cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99); break;
      case "date":    cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
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
          {userDeptName && (
            <span
              className="px-3 py-1.5 text-xs font-semibold rounded-sm hidden sm:inline-flex items-center gap-1.5"
              style={{ background: "rgba(187,10,33,0.1)", color: "rgba(187,10,33,0.85)", border: "1px solid rgba(187,10,33,0.25)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: AUDI_RED }} />
              {userDeptName}
            </span>
          )}
          <Link href="/departments">
            <button className="px-4 py-2 text-xs font-semibold rounded-sm transition-[background-color,border-color,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Departments
            </button>
          </Link>
          {userRole === "superuser" && (
            <Link href="/admin">
              <button
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
                style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Admin
              </button>
            </Link>
          )}
          {userRole !== "audi_staff" && userRole !== "superuser" && (
            <Link href="/apply">
              <button className="px-4 py-2 text-xs font-semibold text-white rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
                style={{ background: AUDI_RED }}>
                + New Application
              </button>
            </Link>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">

        {/* Notification banner */}
        <AnimatePresence>
          {isStaffView && reviewQueue.length > 0 && !bannerDismissed && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="mb-6 px-5 py-3.5 rounded-sm flex items-center justify-between gap-4"
              style={{
                background: "rgba(187,10,33,0.08)",
                border: "1px solid rgba(187,10,33,0.3)",
                boxShadow: "0 0 24px rgba(187,10,33,0.08)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">🔔</span>
                <p className="text-sm font-semibold" style={{ color: AUDI_RED }}>
                  {reviewQueue.length} {reviewQueue.length === 1 ? "Bewerbung wartet" : "Bewerbungen warten"} auf deine Einschätzung
                </p>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-white/25 hover:text-white/60 transition-colors text-lg leading-none flex-shrink-0"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Personalized header */}
        <div className="mb-10">
          {isStaffView ? (
            <>
              <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-2" style={{ color: AUDI_RED }}>
                Hallo, {user?.firstName ?? "Staff"} 👋
              </p>
              <h1 className="text-3xl md:text-4xl font-light text-white">
                Mein <span className="font-semibold">Dashboard</span>
              </h1>
              {userDeptName && (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full"
                    style={{ background: "rgba(187,10,33,0.1)", color: "rgba(187,10,33,0.85)", border: "1px solid rgba(187,10,33,0.25)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: AUDI_RED }} />
                    {userDeptName}
                  </span>
                  {[
                    { label: "Zur Bewertung", value: reviewQueue.length,    color: AUDI_RED },
                    { label: "Meine Apps",    value: ambassadorApps.length, color: "#8b5cf6" },
                    { label: "Bewertet",      value: reviewedCount,         color: "#16a34a" },
                  ].map(({ label, value, color }) => (
                    <span key={label} className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <span className="font-semibold" style={{ color }}>{value}</span> {label}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-2" style={{ color: AUDI_RED }}>
                Staff Dashboard
              </p>
              <h1 className="text-3xl md:text-4xl font-light text-white">
                Startup <span className="font-semibold">Applications</span>
              </h1>
              <p className="text-white/30 text-sm mt-1">Review, rate, and move applications through the pipeline.</p>
            </>
          )}
        </div>

        {/* Review Queue — staff only */}
        {isStaffView && !isLoading && reviewQueue.length > 0 && (
          <div className="mb-10">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: AUDI_RED }} />
              <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                Zur Bewertung ausstehend
              </p>
              <span
                className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                style={{ background: AUDI_RED, color: "#fff" }}
              >
                {reviewQueue.length}
              </span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>

            <div className="space-y-3">
              {reviewQueue.map((app, i) => {
                const deptScore = ((app.departmentScores ?? []) as DepartmentScore[])
                  .find(s => s.departmentId === userDeptId)!;
                return <ReviewCard key={app.id} app={app} deptScore={deptScore} index={i} />;
              })}
            </div>
          </div>
        )}

        {/* Ambassador section — apps where this staff is the assigned ambassador */}
        {isStaffView && !isLoading && ambassadorApps.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#8b5cf6" }} />
              <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                Meine zugewiesenen Bewerbungen
              </p>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "#8b5cf6", color: "#fff" }}>
                {ambassadorApps.length}
              </span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>
            <div className="space-y-3">
              {ambassadorApps.map((app, i) => (
                <AmbassadorCard key={app.id} app={app} index={i} userId={user?.id ?? ""} />
              ))}
            </div>
          </div>
        )}

        {/* Section divider for staff */}
        {isStaffView && !isLoading && (
          <div className="flex items-center gap-3 mb-6">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>
              Alle Bewerbungen
            </p>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total",      value: stats.total,    filter: "all",      color: "rgba(255,255,255,0.6)" },
            { label: "Analyse",    value: stats.analyzed, filter: "analyzed", color: "#d97706"  },
            { label: "Zugewiesen", value: stats.assigned, filter: "assigned", color: "#8b5cf6"  },
            { label: "Erstkontakt",value: stats.approved, filter: "approved", color: "#16a34a"  },
            { label: "Abgelehnt",  value: stats.declined, filter: "declined", color: "#6b7280"  },
          ].map(({ label, value, filter: f, color }) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="p-4 rounded-sm text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.98]"
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
            className="flex-1 px-4 py-2.5 rounded-sm text-sm text-white placeholder-white/25 outline-none transition-[border-color] duration-150"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          />
          <div className="flex gap-2 flex-wrap">
            {["all", "analyzed", "assigned", "approved", "declined", "archived"].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3 py-2 text-xs font-semibold rounded-sm capitalize transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97]"
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
        {!isLoading && !error && sorted.length === 0 && (
          <div className="text-center py-20">
            {search ? (
              <p className="text-white/25 text-sm">No applications match your search.</p>
            ) : (apps ?? []).length === 0 ? (
              <div>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="3" y="5" width="16" height="13" rx="2" stroke="rgba(255,255,255,0.25)" strokeWidth="1.4" />
                    <path d="M7 9h8M7 13h5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M11 1v4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-white/35 text-sm font-medium mb-2">No applications assigned yet</p>
                <p className="text-white/20 text-xs max-w-xs mx-auto leading-relaxed">
                  A superuser needs to assign applications to you. Once assigned, they'll appear here.
                </p>
              </div>
            ) : (
              <p className="text-white/25 text-sm">No applications match the current filter.</p>
            )}
          </div>
        )}

        {/* Table */}
        {sorted.length > 0 && (
          <div className="rounded-sm overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3"
              style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {(
                [
                  { field: "company" as const, label: "Company",   col: "col-span-4",             hidden: false },
                  { field: "stage"   as const, label: "Stage",     col: "col-span-2 hidden md:block", hidden: true },
                  { field: "score"   as const, label: "Top Score", col: "col-span-2 hidden md:block", hidden: true },
                  { field: "rating"  as const, label: "Rating",    col: "col-span-1",             hidden: false },
                  { field: "status"  as const, label: "Status",    col: "col-span-2",             hidden: false },
                  { field: "date"    as const, label: "Date",      col: "col-span-1",             hidden: false, right: true },
                ] as { field: SortField; label: string; col: string; hidden?: boolean; right?: boolean }[]
              ).map(({ field, label, col, right }) => {
                const active = sortField === field;
                return (
                  <button
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`${col} flex items-center gap-1 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-150 select-none ${right ? "justify-end" : ""}`}
                    style={{ color: active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}
                  >
                    {label}
                    <span className="flex flex-col gap-[1px] ml-0.5" style={{ opacity: active ? 1 : 0.3 }}>
                      <svg width="6" height="4" viewBox="0 0 6 4" fill="none" style={{ opacity: active && sortDir === "asc" ? 1 : 0.4 }}>
                        <path d="M3 0L6 4H0L3 0Z" fill="currentColor" />
                      </svg>
                      <svg width="6" height="4" viewBox="0 0 6 4" fill="none" style={{ opacity: active && sortDir === "desc" ? 1 : 0.4 }}>
                        <path d="M3 4L0 0H6L3 4Z" fill="currentColor" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Rows */}
            {sorted.map((app, i) => (
              <AppRow key={app.id} app={app} odd={i % 2 === 1} userDeptId={userDeptId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AppRow({ app, odd, userDeptId }: { app: ApplicationSummary; odd: boolean; userDeptId?: string | null }) {
  const scores = (app.departmentScores ?? []) as DepartmentScore[];
  const myDeptScore = userDeptId ? scores.find(s => s.departmentId === userDeptId) : null;
  const topScore = scores.length > 0 ? Math.max(...scores.map(s => s.score)) : null;
  const topDept = myDeptScore ?? (topScore != null ? scores.find(s => s.score === topScore) : null);

  return (
    <Link href={`/applications/${app.id}`}>
      <div
        className="grid grid-cols-12 gap-4 px-5 py-4 cursor-pointer transition-colors duration-150 group items-center hover:bg-white/[0.02]"
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
  const isSuperuser = isLoaded && meta?.["role"] === "superuser";
  const isStaff = isLoaded && (meta?.["role"] === "audi_staff" || isSuperuser);

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

        {/* Staff / superuser actions panel */}
        {isStaff && (
          <StaffPanel app={app} onSave={save} isSuperuser={isSuperuser} appId={app.id} companyName={app.companyName} />
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
      className="px-3 py-1.5 text-xs font-semibold rounded transition-[background-color,color,border-color] duration-200"
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
// Pipeline steps shared between superuser stepper and status select
const PIPELINE_STEPS = [
  { status: "pending",  label: "Eingereicht", color: "#d97706" },
  { status: "analyzed", label: "Analysiert",  color: "#3b82f6" },
  { status: "assigned", label: "Zugewiesen",  color: "#8b5cf6" },
  { status: "approved", label: "Erstkontakt", color: "#16a34a" },
];

interface StaffUserLite {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
  departmentId?: string | null;
}

function StaffPanel({
  app,
  onSave,
  isSuperuser = false,
  appId,
  companyName,
}: {
  app: { status: string; rating?: number | null; notes?: string | null; nextStep?: string | null; requirements?: RequirementItem[] | null; milestones?: MilestoneItem[] | null; kpis?: KpiItem[] | null; assignedEmployee?: { name: string; role: string; email: string; department: string; clerkId?: string } | null; ndaStatus?: string | null };
  onSave: (data: Record<string, unknown>) => void;
  isSuperuser?: boolean;
  appId?: string;
  companyName?: string;
}) {
  const { getToken } = useAuth();

  const [status, setStatus] = useState(app.status);
  const [rating, setRating] = useState<number>(app.rating ?? 0);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [nextStep, setNextStep] = useState(app.nextStep ?? "");
  const [reqs, setReqs] = useState<RequirementItem[]>(app.requirements ?? []);
  const [milestones, setMilestones] = useState<MilestoneItem[]>(app.milestones ?? []);
  const [kpis, setKpis] = useState<KpiItem[]>(app.kpis ?? []);
  const [saved, setSaved] = useState(false);

  // Meeting feature state
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingContactLoading, setMeetingContactLoading] = useState(false);
  const [meetingContact, setMeetingContact] = useState<{ email: string; firstName: string } | null>(null);
  const [meetingContactError, setMeetingContactError] = useState(false);

  // Onboarding / assignment fields
  const [empName, setEmpName] = useState(app.assignedEmployee?.name ?? "");
  const [empRole, setEmpRole] = useState(app.assignedEmployee?.role ?? "");
  const [empEmail, setEmpEmail] = useState(app.assignedEmployee?.email ?? "");
  const [empDept, setEmpDept] = useState(app.assignedEmployee?.department ?? "");
  const [ndaStatus, setNdaStatus] = useState<string>(app.ndaStatus ?? "pending_signature");

  // Superuser: Clerk staff users
  const [staffUsers, setStaffUsers] = useState<StaffUserLite[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [pickedStaffId, setPickedStaffId] = useState(app.assignedEmployee?.clerkId ?? "");

  // Load Clerk staff users for superuser picker
  useEffect(() => {
    if (!isSuperuser) return;
    setStaffLoading(true);
    getToken()
      .then(token =>
        fetch("/api/admin/users", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
      )
      .then(r => r.json())
      .then((users: StaffUserLite[] & { role?: string }[]) =>
        setStaffUsers(users.filter((u: any) => u.role === "audi_staff")),
      )
      .catch(console.error)
      .finally(() => setStaffLoading(false));
  }, [isSuperuser, getToken]);

  // Pipeline advance helpers
  const currentStepIdx = PIPELINE_STEPS.findIndex(s => s.status === status);
  const nextPipelineStep =
    currentStepIdx >= 0 && currentStepIdx < PIPELINE_STEPS.length - 1
      ? PIPELINE_STEPS[currentStepIdx + 1]
      : null;

  const triggerSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const handleOpenMeeting = async () => {
    setMeetingOpen(true);
    if (meetingContact || !appId) return;
    setMeetingContactLoading(true);
    setMeetingContactError(false);
    try {
      const token = await getToken();
      const res = await fetch(`/api/applications/${appId}/applicant-contact`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setMeetingContact(data);
    } catch {
      setMeetingContactError(true);
    } finally {
      setMeetingContactLoading(false);
    }
  };

  const handleConfirmMeeting = () => {
    const formatted = meetingDate
      ? new Date(meetingDate).toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" })
      : "";
    if (formatted) {
      const newNextStep = `Meeting vorgeschlagen: ${formatted}`;
      setNextStep(newNextStep);
      onSave({ nextStep: newNextStep });
      triggerSaved();
    }
    if (meetingContact?.email && meetingDate) {
      const subject = encodeURIComponent(`Meeting — ${companyName ?? "Innovation Hub"}`);
      const body = encodeURIComponent(
        `Hallo${meetingContact.firstName ? ` ${meetingContact.firstName}` : ""},\n\nwir würden uns gerne mit Ihnen zu einem Meeting treffen.\n\nVorgeschlagener Termin: ${formatted}\n\nMit freundlichen Grüßen\nAudi Innovation Hub`
      );
      window.open(`mailto:${meetingContact.email}?subject=${subject}&body=${body}`, "_blank");
    }
    setMeetingOpen(false);
  };

  const handleAdvance = () => {
    if (!nextPipelineStep) return;
    const newStatus = nextPipelineStep.status;
    setStatus(newStatus);
    onSave({ status: newStatus });
    triggerSaved();
  };

  const handlePickStaff = (userId: string) => {
    setPickedStaffId(userId);
    const user = staffUsers.find(u => u.id === userId);
    if (!user) { setEmpName(""); setEmpEmail(""); setEmpDept(""); return; }
    setEmpName(`${user.firstName} ${user.lastName}`.trim() || user.email);
    setEmpEmail(user.email);
    // Auto-fill department from the staff member's persistent Clerk departmentId
    setEmpDept(user.departmentId ? (DEPARTMENTS[user.departmentId] ?? user.departmentId) : "");
  };

  const handleSave = () => {
    const assignedEmployee = empName && empRole && empEmail && empDept
      ? { name: empName, role: empRole, email: empEmail, department: empDept, clerkId: pickedStaffId || undefined }
      : null;
    // Auto-advance: when superuser sets an ambassador on an 'analyzed' app, move to 'assigned'
    const effectiveStatus = (assignedEmployee && app.status === "analyzed" && status === "analyzed")
      ? "assigned"
      : status;
    onSave({ status: effectiveStatus, rating: rating || null, notes, nextStep, requirements: reqs, milestones, kpis, assignedEmployee, ndaStatus: ndaStatus || null });
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
        <div className="flex items-center gap-2">
          {appId && (
            <button
              onClick={handleOpenMeeting}
              className="px-4 py-2 text-sm font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97] flex items-center gap-1.5"
              style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 1v3M10 1v3M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Meeting einberufen
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold text-white rounded-sm transition-[background-color,transform] duration-200 active:scale-[0.97]"
            style={{ background: saved ? "#16a34a" : AUDI_RED }}
          >
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Meeting modal */}
      {meetingOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setMeetingOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-sm overflow-hidden"
            style={{ background: "#0f0f1e", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase font-semibold mb-0.5" style={{ color: "#60a5fa" }}>Meeting einberufen</p>
                <p className="text-white font-semibold text-sm">{companyName}</p>
              </div>
              <button onClick={() => setMeetingOpen(false)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-2">Vorgeschlagener Termin</p>
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={e => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-sm text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
                />
              </div>
              {meetingContactLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: "#60a5fa transparent transparent transparent" }} />
                  <p className="text-white/30 text-xs">Bewerber-Kontakt wird geladen…</p>
                </div>
              )}
              {meetingContactError && (
                <p className="text-white/30 text-xs">Kein Bewerber-Account mit dieser Bewerbung verknüpft. Datum wird trotzdem als Next Step gespeichert.</p>
              )}
              {meetingContact && (
                <div className="px-3 py-2.5 rounded-sm flex items-center gap-2" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 7a3 3 0 100-6 3 3 0 000 6zM1.5 13c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5" stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  <p className="text-xs" style={{ color: "#93c5fd" }}>{meetingContact.email}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={() => setMeetingOpen(false)} className="px-4 py-2 text-xs font-semibold rounded-sm hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Abbrechen
              </button>
              <button
                onClick={handleConfirmMeeting}
                disabled={!meetingDate}
                className="px-4 py-2 text-xs font-semibold text-white rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#3b82f6" }}
              >
                {meetingContact?.email ? "Datum speichern & E-Mail öffnen" : "Datum als Next Step speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Superuser admin controls ── */}
      {isSuperuser && (
        <div
          className="rounded-sm overflow-hidden"
          style={{ border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.03)" }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(245,158,11,0.15)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b" }} />
            <p className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
              Admin Controls — Superuser Only
            </p>
          </div>

          <div className="p-5 space-y-6">
            {/* ── Pipeline stepper ── */}
            <div>
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-4">
                Advance to Next Round
              </p>

              {/* Step indicators */}
              <div className="flex items-center mb-5">
                {PIPELINE_STEPS.map((step, idx) => {
                  const isActive = step.status === status;
                  const isDone = idx < currentStepIdx;
                  return (
                    <div key={step.status} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                          style={{
                            background: isActive
                              ? step.color
                              : isDone
                                ? "rgba(255,255,255,0.12)"
                                : "rgba(255,255,255,0.05)",
                            color: isActive ? "#fff" : isDone ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.2)",
                            border: `1.5px solid ${isActive ? step.color : isDone ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)"}`,
                            boxShadow: isActive ? `0 0 14px ${step.color}50` : "none",
                          }}
                        >
                          {isDone ? (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <p
                          className="text-[9px] mt-1.5 font-semibold tracking-wide"
                          style={{ color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)" }}
                        >
                          {step.label.toUpperCase()}
                        </p>
                      </div>
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <div
                          className="flex-1 h-px mx-2 mb-4 transition-[background-color] duration-300"
                          style={{
                            background: idx < currentStepIdx
                              ? "rgba(255,255,255,0.18)"
                              : "rgba(255,255,255,0.07)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Advance button */}
              {nextPipelineStep ? (
                <button
                  onClick={handleAdvance}
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-sm text-sm font-semibold text-white transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.98]"
                  style={{ background: nextPipelineStep.color }}
                >
                  Advance to
                  <span className="font-bold">{nextPipelineStep.label}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <div
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-sm"
                  style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                    Finale Stufe erreicht — Erstkontakt hergestellt
                  </p>
                </div>
              )}
            </div>

            {/* ── Assign Audi Staff Member ── */}
            <div>
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">
                Assign Audi Staff Member
              </p>

              {staffLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#f59e0b transparent transparent transparent" }} />
                  <p className="text-white/30 text-xs">Loading staff users…</p>
                </div>
              ) : staffUsers.length === 0 ? (
                <p className="text-white/25 text-xs leading-relaxed">
                  No Audi staff users found. Assign the <code className="font-mono text-[10px] bg-white/5 px-1 rounded">audi_staff</code> role to users in the Admin panel first.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Picker */}
                  <select
                    value={pickedStaffId}
                    onChange={e => handlePickStaff(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-sm text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <option value="">— Select a staff member —</option>
                    {staffUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {`${u.firstName} ${u.lastName}`.trim() || u.email}
                      </option>
                    ))}
                  </select>

                  {/* Preview card */}
                  {pickedStaffId && (() => {
                    const picked = staffUsers.find(u => u.id === pickedStaffId);
                    return (
                      <div
                        className="flex items-center gap-3 px-4 py-3 rounded-sm"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        {picked?.imageUrl ? (
                          <img src={picked.imageUrl} className="w-9 h-9 rounded-full flex-shrink-0 object-cover" alt="" />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                          >
                            {empName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <p className="text-white text-sm font-semibold">{empName || "—"}</p>
                          <p className="text-white/35 text-xs">{empEmail}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Role + Department (editable after picking) */}
                  {pickedStaffId && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { label: "Role / Title", value: empRole, setter: setEmpRole, ph: "e.g. Innovation Manager" },
                        { label: "Department", value: empDept, setter: setEmpDept, ph: "e.g. R&D Partnerships" },
                      ].map(({ label, value, setter, ph }) => (
                        <div key={label}>
                          <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wide mb-1">{label}</p>
                          <input
                            value={value}
                            onChange={e => setter(e.target.value)}
                            placeholder={ph}
                            className="w-full px-3 py-2 rounded-sm text-sm text-white placeholder-white/20 outline-none"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
            <option value="pending">In Analyse</option>
            <option value="analyzed">Analysiert</option>
            <option value="assigned">Zugewiesen</option>
            <option value="approved">Erstkontakt</option>
            <option value="declined">Abgelehnt</option>
            <option value="archived">Archiviert</option>
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

      {/* Onboarding — shown when ambassador assigned or first contact made */}
      {(status === "assigned" || status === "approved") && (
        <div className="rounded-sm overflow-hidden" style={{ border: "1px solid rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.04)" }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(22,163,74,0.12)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
            <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>Ambassador-Onboarding — für Bewerber sichtbar</p>
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
                    className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[background-color,color,border-color] duration-200 active:scale-[0.97]"
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
            className="px-3 py-1 text-xs font-semibold rounded-sm transition-[background-color,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            + Add
          </button>
        </div>
        {reqs.length === 0 && <p className="text-white/20 text-xs">No requirements defined yet.</p>}
        <div className="space-y-2">
          {reqs.map(req => (
            <div key={req.id} className="flex items-center gap-3">
              <button onClick={() => toggleReq(req.id)} className="flex-shrink-0">
                <div className="w-4 h-4 rounded-sm flex items-center justify-center transition-[background-color,border-color] duration-150"
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
            className="px-3 py-1 text-xs font-semibold rounded-sm transition-[background-color,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
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
            className="px-3 py-1 text-xs font-semibold rounded-sm transition-[background-color,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
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
          className="px-7 py-3 text-sm font-semibold text-white rounded-sm transition-[background-color,transform] duration-200 active:scale-[0.97]"
          style={{ background: saved ? "#16a34a" : AUDI_RED }}
        >
          {saved ? "✓ Changes Saved" : "Save All Changes"}
        </button>
      </div>
    </motion.div>
  );
}
