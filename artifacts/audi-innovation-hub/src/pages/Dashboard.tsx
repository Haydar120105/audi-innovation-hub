import { Link } from "wouter";
import { UserButton } from "@clerk/clerk-react";
import { useUser } from "@clerk/clerk-react";
import { useListApplications } from "@workspace/api-client-react";
import type { ApplicationSummary, AssignedEmployee } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

const AUDI_RED = "#BB0A21";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string;
  icon: string; nextStep: string; nextStepDetail: string;
}> = {
  pending: {
    label: "In Bearbeitung", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)",
    icon: "⏳",
    nextStep: "Deine Bewerbung wird analysiert",
    nextStepDetail: "Unsere KI extrahiert die wichtigsten Daten und erstellt einen Businesscase. Das dauert nur wenige Minuten.",
  },
  analyzed: {
    label: "Analysiert", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)",
    icon: "🔍",
    nextStep: "Analyse abgeschlossen — passende Abteilungen werden benachrichtigt",
    nextStepDetail: "Deine Bewerbung wurde ausgewertet und an die Audi-Abteilungen mit der höchsten Übereinstimmung weitergeleitet.",
  },
  assigned: {
    label: "Ambassador zugewiesen", color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)",
    icon: "👤",
    nextStep: "Dein Startup Ambassador nimmt bald Kontakt auf",
    nextStepDetail: "Ein persönlicher Ansprechpartner bei Audi wurde dir zugewiesen. Er wird sich in Kürze bei dir melden.",
  },
  approved: {
    label: "Erstkontakt hergestellt", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)",
    icon: "✅",
    nextStep: "Dein Ambassador hat sich gemeldet — nächste Schritte folgen",
    nextStepDetail: "Herzlichen Glückwunsch! Dein Startup Ambassador hat Erstkontakt hergestellt. Schau dir die Onboarding-Schritte unten an.",
  },
  declined: {
    label: "Nicht weitergeleitet", color: "#9ca3af", bg: "rgba(156,163,175,0.06)", border: "rgba(156,163,175,0.12)",
    icon: "○",
    nextStep: "Danke für deine Bewerbung",
    nextStepDetail: "Diese Bewerbung wurde leider nicht weitergeleitet. Du kannst dich gerne in unserer nächsten Runde erneut bewerben.",
  },
  archived: {
    label: "Archiviert", color: "#6b7280", bg: "rgba(107,114,128,0.05)", border: "rgba(107,114,128,0.1)",
    icon: "○",
    nextStep: "Bewerbung archiviert",
    nextStepDetail: "Diese Bewerbung wurde archiviert.",
  },
};

const PIPELINE = [
  { key: "pending",  label: "Eingereicht" },
  { key: "analyzed", label: "Analysiert"  },
  { key: "assigned", label: "Zugewiesen"  },
  { key: "approved", label: "Erstkontakt" },
];

// ── Pipeline bar ──────────────────────────────────────────────────────────────

function PipelineBar({ status }: { status: string }) {
  const declined = status === "declined" || status === "archived";
  const currentIdx = PIPELINE.findIndex(s => s.key === status);
  const activeIdx = declined ? -1 : currentIdx;

  return (
    <div className="flex items-start gap-0 mt-5 mb-2">
      {PIPELINE.map((step, i) => {
        const done   = activeIdx >= i;
        const active = activeIdx === i;
        const last   = i === PIPELINE.length - 1;
        return (
          <div key={step.key} className="flex items-center" style={{ flex: last ? "0 0 auto" : 1 }}>
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                style={{
                  background: declined ? "rgba(255,255,255,0.03)" : done ? AUDI_RED : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${declined ? "rgba(255,255,255,0.08)" : done ? AUDI_RED : "rgba(255,255,255,0.12)"}`,
                  boxShadow: active && !declined ? `0 0 12px ${AUDI_RED}60` : "none",
                }}
              >
                {done && !declined && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-[9px] font-medium uppercase tracking-[0.08em] whitespace-nowrap"
                style={{ color: declined ? "rgba(255,255,255,0.15)" : done ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)" }}>
                {step.label}
              </span>
            </div>
            {!last && (
              <div className="flex-1 h-px mx-2 mb-5 transition-colors duration-500"
                style={{ background: declined ? "rgba(255,255,255,0.06)" : activeIdx > i ? AUDI_RED : "rgba(255,255,255,0.08)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Next step hint ────────────────────────────────────────────────────────────

function NextStepHint({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <div className="mt-4 rounded-lg px-4 py-3.5 flex items-start gap-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ background: cfg.color }} />
      <div>
        <p className="text-sm font-semibold leading-snug mb-1" style={{ color: cfg.color }}>{cfg.nextStep}</p>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{cfg.nextStepDetail}</p>
      </div>
    </div>
  );
}

// ── Onboarding section ────────────────────────────────────────────────────────

function OnboardingSection({ app }: { app: ApplicationSummary }) {
  const employee = app.assignedEmployee as AssignedEmployee | undefined;
  const ndaSigned = app.ndaStatus === "signed";

  const steps: Array<{ number: string; title: string; description: string; done: boolean; action: React.ReactNode }> = [
    {
      number: "01", title: "Review & sign the NDA",
      description: ndaSigned ? "You've signed the NDA. You're clear for the next step." : "A Non-Disclosure Agreement protects both parties. Review and sign before proceeding.",
      done: ndaSigned,
      action: ndaSigned ? null : (
        <a href="/nda-template.pdf" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-md transition-opacity hover:opacity-85"
          style={{ background: AUDI_RED }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 8.5h7M5.5 1.5v5M3 5l2.5 2.5L8 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download NDA
        </a>
      ),
    },
    {
      number: "02", title: "Meet your Audi contact",
      description: employee ? `${employee.name} from ${employee.department} is your dedicated point of contact.` : "Your Audi contact is being assigned. We'll confirm shortly.",
      done: !!employee,
      action: employee ? (
        <div className="rounded-lg p-4 flex items-center gap-4 mt-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: "rgba(187,10,33,0.15)", color: AUDI_RED, border: `1px solid rgba(187,10,33,0.25)` }}>
            {employee.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-tight">{employee.name}</p>
            <p className="text-white/50 text-xs mt-0.5">{employee.role} · {employee.department}</p>
            <a href={`mailto:${employee.email}`} className="text-xs font-medium mt-1 inline-block hover:opacity-70 transition-opacity" style={{ color: AUDI_RED }}>
              {employee.email}
            </a>
          </div>
        </div>
      ) : null,
    },
    {
      number: "03", title: "Schedule your kickoff",
      description: "Book a first meeting with your Audi contact to align on goals, timelines, and next steps.",
      done: false,
      action: employee ? (
        <a href={`mailto:${employee.email}?subject=Kickoff%20Meeting%20%E2%80%94%20${encodeURIComponent(app.companyName)}`}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md hover:opacity-80 transition-opacity mt-1"
          style={{ color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1.5" y="2" width="8" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 1v2M7.5 1v2M1.5 5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Send meeting request
        </a>
      ) : null,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
      className="mt-4 rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.04)" }}>
      <div className="px-5 py-3.5 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(52,211,153,0.12)" }}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52,211,153,0.2)" }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 4.5l1.5 1.5L7 2" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-semibold" style={{ color: "#34d399" }}>Congratulations — complete your onboarding</p>
      </div>
      <div>
        {steps.map((step, i) => (
          <div key={step.number} className="px-5 py-4" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
            <div className="flex items-start gap-4">
              <span className="text-xs font-bold tabular-nums mt-0.5 flex-shrink-0 w-6"
                style={{ color: step.done ? "#34d399" : "rgba(255,255,255,0.25)" }}>
                {step.done ? "✓" : step.number}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight mb-1"
                  style={{ color: step.done ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.88)" }}>
                  {step.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{step.description}</p>
                {step.action && <div className="mt-3">{step.action}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Application card ──────────────────────────────────────────────────────────

function AppCard({ app, idx }: { app: ApplicationSummary; idx: number }) {
  const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending;
  const isOnboarding = app.status === "assigned" || app.status === "approved";
  const date = new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + idx * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isOnboarding ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Top accent line */}
      <div className="h-[2px] w-full" style={{
        background: isOnboarding
          ? "linear-gradient(90deg, #34d399, transparent)"
          : `linear-gradient(90deg, ${AUDI_RED}, transparent)`
      }} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-lg leading-tight truncate">{app.companyName}</h3>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
              {app.stage && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}>
                  {app.stage}
                </span>
              )}
              {app.teamSize && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}>
                  {app.teamSize} people
                </span>
              )}
              <span className="text-white/35 text-xs">{date}</span>
            </div>
          </div>

          {/* Status badge */}
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
            {cfg.label}
          </span>
        </div>

        {/* Pipeline */}
        <PipelineBar status={app.status} />

        {/* Next step / onboarding */}
        {isOnboarding ? <OnboardingSection app={app} /> : <NextStepHint status={app.status} />}

        {/* Footer */}
        <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-white/25 text-[10px] font-mono tracking-wider">
            REF · {app.id.slice(0, 8).toUpperCase()}
          </span>
          <Link href={`/track/${app.trackingToken}`}>
            <button className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: AUDI_RED }}>
              View full details
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6h7M6 2.5l3.5 3.5L6 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(187,10,33,0.08)", border: "1px solid rgba(187,10,33,0.15)" }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path d="M13 4v18M4 13h18" stroke={AUDI_RED} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-white text-2xl font-light mb-3">No applications yet</h3>
      <p className="text-white/45 text-sm max-w-xs leading-relaxed mb-8">
        Start your first application to connect with Audi's Innovation Hub and the right teams.
      </p>
      <Link href="/apply">
        <button className="px-7 py-3 text-sm font-semibold text-white rounded-lg transition-[opacity,transform] hover:opacity-85 active:scale-[0.97]"
          style={{ background: AUDI_RED }}>
          Apply now
        </button>
      </Link>
    </motion.div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1"
      style={{
        background: accent ? "rgba(187,10,33,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${accent ? "rgba(187,10,33,0.18)" : "rgba(255,255,255,0.07)"}`,
      }}>
      <span className="text-3xl font-light" style={{ color: accent ? AUDI_RED : "rgba(255,255,255,0.9)" }}>{value}</span>
      <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ApplicantDashboard() {
  const { data: apps, isLoading, error } = useListApplications();
  const { user } = useUser();
  const role = user?.publicMetadata?.["role"] as string | undefined;
  const hasApps = (apps?.length ?? 0) > 0;
  const approvedCount = apps?.filter(a => a.status === "approved").length ?? 0;
  const activeCount   = apps?.filter(a => ["pending","analyzed","assigned"].includes(a.status)).length ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0d0d1f 0%, #080812 60%)" }}>

      {/* Nav */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(8,8,18,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/">
          <span className="flex items-center gap-3 cursor-pointer group">
            <img src="/audi-logo.png" alt="Audi" className="h-6 w-auto"
              style={{ opacity: 0.85, filter: "brightness(0) invert(1)" }} />
            <span className="text-white/40 text-xs tracking-[0.22em] uppercase font-semibold group-hover:text-white/65 transition-colors">
              Innovation Hub
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {role && (
            <span className="px-2.5 py-1 text-[10px] font-semibold rounded-md tracking-wide hidden sm:inline"
              style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
              {role === "audi_staff" ? "Audi Staff" : role === "superuser" ? "Admin" : "Applicant"}
            </span>
          )}
          {hasApps && (
            <Link href="/apply">
              <button className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-[opacity,transform] hover:opacity-85 active:scale-[0.97]"
                style={{ background: AUDI_RED }}>
                + New application
              </button>
            </Link>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-24">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-10">
          <p className="text-[10px] tracking-[0.35em] font-semibold uppercase mb-3" style={{ color: AUDI_RED }}>
            My Applications
          </p>
          <h1 className="text-3xl font-light text-white leading-tight">
            {user?.firstName ? `Welcome back, ${user.firstName}.` : "Your dashboard"}
          </h1>
          <p className="text-white/45 text-sm mt-2 leading-relaxed">
            Track every application you've submitted to Audi's Innovation Hub.
          </p>
        </motion.div>

        {/* Stats */}
        <AnimatePresence>
          {hasApps && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="grid grid-cols-3 gap-3 mb-10">
              <StatCard label="Total submitted" value={apps!.length} />
              <StatCard label="In progress"     value={activeCount} />
              <StatCard label="Erstkontakt"      value={approvedCount} accent={approvedCount > 0} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-28">
            <div className="flex gap-2">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: AUDI_RED }}
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="rounded-xl p-6 text-center"
            style={{ background: "rgba(187,10,33,0.05)", border: "1px solid rgba(187,10,33,0.15)" }}>
            <p className="text-white/55 text-sm">Failed to load your applications. Please refresh.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && !hasApps && <EmptyState />}

        {/* Cards */}
        {!isLoading && !error && hasApps && (
          <div className="flex flex-col gap-5">
            {apps!.map((app, i) => <AppCard key={app.id} app={app} idx={i} />)}
          </div>
        )}

        {/* Footer hint */}
        {!isLoading && hasApps && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-12 text-center text-white/30 text-xs">
            Want to apply to another department?{" "}
            <Link href="/apply">
              <span className="text-white/50 hover:text-white/70 transition-colors cursor-pointer underline underline-offset-2 decoration-white/25">
                Submit another application
              </span>
            </Link>
          </motion.p>
        )}
      </div>
    </div>
  );
}
