import { Link } from "wouter";
import { UserButton, useAuth } from "@clerk/clerk-react";
import { useListApplications } from "@workspace/api-client-react";
import type { ApplicationSummary } from "@workspace/api-client-react";
import { motion } from "framer-motion";

const AUDI_RED = "#BB0A21";

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:     { label: "Pending Review", color: "#d97706", bg: "rgba(217,119,6,0.1)",   dot: "#d97706" },
  routed:      { label: "Under Analysis", color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  dot: "#3b82f6" },
  shortlisted: { label: "Shortlisted",    color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  dot: "#8b5cf6" },
  accepted:    { label: "Accepted",       color: "#16a34a", bg: "rgba(22,163,74,0.1)",   dot: "#16a34a" },
  declined:    { label: "Declined",       color: "#6b7280", bg: "rgba(107,114,128,0.08)", dot: "#6b7280" },
  archived:    { label: "Archived",       color: "#4b5563", bg: "rgba(75,85,99,0.06)",   dot: "#4b5563" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

// ── Timeline step ─────────────────────────────────────────────────────────────

const PIPELINE: { key: string; label: string }[] = [
  { key: "pending",     label: "Submitted"   },
  { key: "routed",      label: "Analysis"    },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "accepted",    label: "Accepted"    },
];

function PipelineBar({ status }: { status: string }) {
  const declined = status === "declined" || status === "archived";
  const currentIdx = PIPELINE.findIndex(s => s.key === status);
  const activeIdx = declined ? -1 : currentIdx;

  return (
    <div className="flex items-center gap-0 mt-4">
      {PIPELINE.map((step, i) => {
        const done   = activeIdx >= i;
        const active = activeIdx === i;
        const last   = i === PIPELINE.length - 1;
        return (
          <div key={step.key} className="flex items-center" style={{ flex: last ? "0 0 auto" : 1 }}>
            {/* Dot */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: declined ? "rgba(255,255,255,0.06)" : done ? AUDI_RED : "rgba(255,255,255,0.06)",
                border: `2px solid ${declined ? "rgba(255,255,255,0.1)" : done ? AUDI_RED : "rgba(255,255,255,0.12)"}`,
                boxShadow: active && !declined ? `0 0 8px ${AUDI_RED}66` : "none",
              }}
            >
              {done && !declined && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {/* Label */}
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.08em] absolute"
              style={{
                color: declined ? "rgba(255,255,255,0.15)" : done ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
                marginTop: 28,
                transform: "translateX(-50%)",
              }}
            >
              {step.label}
            </span>
            {/* Connector line */}
            {!last && (
              <div
                className="flex-1 h-px mx-0.5"
                style={{
                  background: declined ? "rgba(255,255,255,0.06)"
                    : activeIdx > i ? AUDI_RED : "rgba(255,255,255,0.08)",
                }}
              />
            )}
          </div>
        );
      })}
      {/* Declined indicator */}
      {declined && (
        <span className="ml-3 text-[10px] font-semibold" style={{ color: "#6b7280" }}>
          Not progressed
        </span>
      )}
    </div>
  );
}

// ── Application card ──────────────────────────────────────────────────────────

function AppCard({ app, idx }: { app: ApplicationSummary; idx: number }) {
  const date = new Date(app.createdAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + idx * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-sm overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Top accent */}
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${AUDI_RED}, transparent)` }} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-white font-semibold text-base leading-tight">{app.companyName}</p>
            <div className="flex items-center gap-3 mt-1">
              {app.stage && (
                <span className="text-white/35 text-xs">{app.stage}</span>
              )}
              {app.teamSize && (
                <>
                  <span className="text-white/15 text-xs">·</span>
                  <span className="text-white/35 text-xs">{app.teamSize} people</span>
                </>
              )}
              <span className="text-white/15 text-xs">·</span>
              <span className="text-white/25 text-xs">{date}</span>
            </div>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* Pipeline timeline */}
        <div className="relative mb-8">
          <PipelineBar status={app.status} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-white/15 text-[10px] font-mono tracking-wide">
            ID: {app.id.slice(0, 8).toUpperCase()}
          </span>
          <Link href={`/track/${app.trackingToken}`}>
            <button
              className="text-xs font-semibold transition-opacity hover:opacity-70 flex items-center gap-1"
              style={{ color: AUDI_RED }}
            >
              Track application
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: "rgba(187,10,33,0.08)", border: "1px solid rgba(187,10,33,0.15)" }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 4v16M7 14h14" stroke={AUDI_RED} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-white text-lg font-light mb-2">No applications yet</h3>
      <p className="text-white/35 text-sm max-w-xs leading-relaxed mb-8">
        Submit your first application to connect with Audi's Innovation Hub and the teams you want to work with.
      </p>
      <Link href="/apply">
        <button
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
          style={{ background: AUDI_RED }}
        >
          Apply Now →
        </button>
      </Link>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApplicantDashboard() {
  const { data: apps, isLoading, error } = useListApplications();
  const { sessionClaims } = useAuth();
  const meta = sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
  const role = meta?.["role"] as string | undefined;

  const hasApps = (apps?.length ?? 0) > 0;

  return (
    <div className="min-h-screen" style={{ background: "#0A0A14" }}>

      {/* ── Nav bar ── */}
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
            <img
              src="/audi-logo.png"
              alt="Audi"
              className="h-6 w-auto transition-opacity group-hover:opacity-90"
              style={{ opacity: 0.85, filter: "brightness(0) invert(1)" }}
            />
            <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold group-hover:text-white/70 transition-colors">
              Innovation Hub
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Role pill */}
          {role && (
            <span
              className="px-2.5 py-1 text-[10px] font-semibold rounded-sm tracking-wide hidden sm:inline"
              style={{
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {role === "audi_staff" ? "Audi Staff" : role === "superuser" ? "Admin" : "Applicant"}
            </span>
          )}
          {hasApps && (
            <Link href="/apply">
              <button
                className="px-4 py-2 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
                style={{ background: AUDI_RED }}
              >
                + New Application
              </button>
            </Link>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-20">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p
            className="text-[11px] tracking-[0.28em] font-semibold uppercase mb-2"
            style={{ color: AUDI_RED }}
          >
            Applicant Dashboard
          </p>
          <h1 className="text-3xl md:text-4xl font-light text-white leading-tight">
            My <span className="font-semibold">Applications</span>
          </h1>
          <p className="text-white/30 text-sm mt-2">
            Track the status of every application you've submitted to Audi's Innovation Hub.
          </p>
        </motion.div>

        {/* Stats strip */}
        {hasApps && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="grid grid-cols-3 gap-3 mb-8"
          >
            {[
              { label: "Submitted",    value: apps!.length },
              { label: "In Progress",  value: apps!.filter(a => ["pending","routed","shortlisted"].includes(a.status)).length },
              { label: "Accepted",     value: apps!.filter(a => a.status === "accepted").length },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-sm py-4 px-5 text-center"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-2xl font-light text-white mb-0.5">{value}</p>
                <p className="text-white/30 text-[10px] tracking-[0.12em] uppercase">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-24">
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: AUDI_RED }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="rounded-sm p-6 text-center" style={{ background: "rgba(187,10,33,0.06)", border: "1px solid rgba(187,10,33,0.15)" }}>
            <p className="text-white/50 text-sm">Failed to load applications. Please try again.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && !hasApps && <EmptyState />}

        {/* Application cards */}
        {!isLoading && !error && hasApps && (
          <div className="flex flex-col gap-4">
            {apps!.map((app, i) => (
              <AppCard key={app.id} app={app} idx={i} />
            ))}
          </div>
        )}

        {/* Apply CTA at bottom if there are already apps */}
        {!isLoading && hasApps && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-10 text-center"
          >
            <p className="text-white/20 text-xs mb-3">Want to apply to another department?</p>
            <Link href="/apply">
              <button
                className="px-6 py-2.5 text-xs font-semibold rounded-sm transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                Submit Another Application
              </button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
