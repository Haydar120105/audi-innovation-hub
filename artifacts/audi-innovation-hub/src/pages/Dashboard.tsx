import { Link } from "wouter";
import { UserButton } from "@clerk/clerk-react";
import { useUser } from "@clerk/clerk-react";
import { useListApplications } from "@workspace/api-client-react";
import type { ApplicationSummary, AssignedEmployee } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

const AUDI_RED = "#BB0A21";

// ── Status configuration ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  nextStep: string;
  nextStepDetail: string;
}> = {
  pending: {
    label: "Under Review",
    color: "#d97706",
    bg: "rgba(217,119,6,0.1)",
    nextStep: "Your application is being reviewed",
    nextStepDetail: "Our team reviews every submission carefully. You'll hear from us within 2 weeks.",
  },
  routed: {
    label: "In Analysis",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.1)",
    nextStep: "Matching you with the right team",
    nextStepDetail: "We're identifying which Audi department is the best fit for your solution. No action needed.",
  },
  shortlisted: {
    label: "Shortlisted",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.1)",
    nextStep: "Prepare a short presentation",
    nextStepDetail: "You've made it to the shortlist. We recommend preparing a 5-minute overview of your solution for the next stage.",
  },
  accepted: {
    label: "Accepted",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.1)",
    nextStep: "Complete your onboarding",
    nextStepDetail: "Congratulations. Sign the NDA and connect with your Audi contact to get started.",
  },
  declined: {
    label: "Not Progressed",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.08)",
    nextStep: "Thank you for applying",
    nextStepDetail: "This application didn't progress further. You're welcome to apply again in our next cohort.",
  },
  archived: {
    label: "Archived",
    color: "#4b5563",
    bg: "rgba(75,85,99,0.06)",
    nextStep: "Application archived",
    nextStepDetail: "This application has been archived.",
  },
};

const PIPELINE = [
  { key: "pending",     label: "Submitted"   },
  { key: "routed",      label: "Analysis"    },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "accepted",    label: "Accepted"    },
];

// ── Pipeline bar ──────────────────────────────────────────────────────────────

function PipelineBar({ status }: { status: string }) {
  const declined = status === "declined" || status === "archived";
  const currentIdx = PIPELINE.findIndex(s => s.key === status);
  const activeIdx = declined ? -1 : currentIdx;

  return (
    <div className="flex items-start mt-4 mb-1">
      {PIPELINE.map((step, i) => {
        const done   = activeIdx >= i;
        const active = activeIdx === i;
        const last   = i === PIPELINE.length - 1;
        return (
          <div key={step.key} className="flex items-center" style={{ flex: last ? "0 0 auto" : 1 }}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                style={{
                  background: declined ? "rgba(255,255,255,0.04)" : done ? AUDI_RED : "rgba(255,255,255,0.06)",
                  border: `2px solid ${declined ? "rgba(255,255,255,0.08)" : done ? AUDI_RED : "rgba(255,255,255,0.1)"}`,
                  boxShadow: active && !declined ? `0 0 10px ${AUDI_RED}55` : "none",
                }}
              >
                {done && !declined && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className="text-[9px] font-semibold uppercase tracking-[0.07em] whitespace-nowrap"
                style={{ color: declined ? "rgba(255,255,255,0.12)" : done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)" }}
              >
                {step.label}
              </span>
            </div>
            {!last && (
              <div
                className="flex-1 h-px mx-2 mb-4 transition-all duration-500"
                style={{ background: declined ? "rgba(255,255,255,0.05)" : activeIdx > i ? AUDI_RED : "rgba(255,255,255,0.07)" }}
              />
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
    <div
      className="mt-5 rounded-sm px-4 py-3 flex items-start gap-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      <div>
        <p className="text-white/65 text-xs font-semibold leading-none mb-1">{cfg.nextStep}</p>
        <p className="text-white/28 text-xs leading-relaxed">{cfg.nextStepDetail}</p>
      </div>
    </div>
  );
}

// ── Onboarding section (accepted only) ───────────────────────────────────────

function OnboardingSection({ app }: { app: ApplicationSummary }) {
  const employee = app.assignedEmployee as AssignedEmployee | undefined;
  const ndaSigned = app.ndaStatus === "signed";

  const steps: Array<{
    number: string;
    title: string;
    description: string;
    done: boolean;
    action: React.ReactNode;
  }> = [
    {
      number: "01",
      title: "Review & sign the NDA",
      description: ndaSigned
        ? "You've signed the NDA. You're clear for the next step."
        : "A Non-Disclosure Agreement protects both parties. Review and sign before proceeding.",
      done: ndaSigned,
      action: ndaSigned ? null : (
        <a
          href="/nda-template.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
          style={{ background: AUDI_RED }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 8.5h7M5.5 1.5v5M3 5l2.5 2.5L8 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download NDA
        </a>
      ),
    },
    {
      number: "02",
      title: "Meet your Audi contact",
      description: employee
        ? `${employee.name} from ${employee.department} is your dedicated point of contact.`
        : "Your Audi contact is being assigned. We'll confirm shortly.",
      done: !!employee,
      action: employee ? (
        <div
          className="rounded-sm p-4 flex items-center gap-4 mt-1"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: "rgba(187,10,33,0.12)", color: AUDI_RED, border: `1px solid rgba(187,10,33,0.18)` }}
          >
            {employee.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-tight">{employee.name}</p>
            <p className="text-white/35 text-xs mt-0.5">{employee.role} · {employee.department}</p>
            <a
              href={`mailto:${employee.email}`}
              className="text-xs font-medium mt-1 inline-block transition-opacity hover:opacity-70"
              style={{ color: AUDI_RED }}
            >
              {employee.email}
            </a>
          </div>
        </div>
      ) : null,
    },
    {
      number: "03",
      title: "Schedule your kickoff",
      description: "Book a first meeting with your Audi contact to align on goals, timelines, and next steps.",
      done: false,
      action: employee ? (
        <a
          href={`mailto:${employee.email}?subject=Kickoff%20Meeting%20%E2%80%94%20${encodeURIComponent(app.companyName)}&body=Hi%20${encodeURIComponent(employee.name)}%2C%0A%0AI%20would%20love%20to%20schedule%20our%20kickoff%20meeting.%20Please%20let%20me%20know%20your%20availability.%0A%0ABest%20regards`}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-sm transition-opacity hover:opacity-80 mt-1"
          style={{ color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="mt-5 rounded-sm overflow-hidden"
      style={{ border: "1px solid rgba(22,163,74,0.18)", background: "rgba(22,163,74,0.025)" }}
    >
      <div className="px-5 py-3.5 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(22,163,74,0.1)" }}>
        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(22,163,74,0.18)" }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4l1.5 1.5 3.5-3.5" stroke="#16a34a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
          Congratulations — complete your onboarding
        </p>
      </div>

      <div>
        {steps.map((step, i) => (
          <div
            key={step.number}
            className="px-5 py-4"
            style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}
          >
            <div className="flex items-start gap-4">
              <span
                className="text-xs font-bold tabular-nums mt-0.5 flex-shrink-0 w-6"
                style={{ color: step.done ? "#16a34a" : "rgba(255,255,255,0.18)" }}
              >
                {step.done ? "✓" : step.number}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold leading-tight mb-1"
                  style={{ color: step.done ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.82)" }}
                >
                  {step.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.28)" }}>
                  {step.description}
                </p>
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
  const isAccepted = app.status === "accepted";
  const date = new Date(app.createdAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 + idx * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-sm overflow-hidden"
      style={{
        background: isAccepted ? "rgba(22,163,74,0.03)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isAccepted ? "rgba(22,163,74,0.18)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <div className="h-px w-full" style={{
        background: isAccepted
          ? "linear-gradient(90deg, #16a34a44, transparent)"
          : `linear-gradient(90deg, ${AUDI_RED}66, transparent)`
      }} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <p className="text-white font-semibold text-base leading-tight">{app.companyName}</p>
            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
              {app.stage && <span className="text-white/28 text-xs">{app.stage}</span>}
              {app.teamSize && (
                <>
                  <span className="text-white/14 text-xs">·</span>
                  <span className="text-white/28 text-xs">{app.teamSize} people</span>
                </>
              )}
              <span className="text-white/14 text-xs">·</span>
              <span className="text-white/18 text-xs">{date}</span>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}28` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
            {cfg.label}
          </span>
        </div>

        <PipelineBar status={app.status} />

        {isAccepted
          ? <OnboardingSection app={app} />
          : <NextStepHint status={app.status} />
        }

        <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <span className="text-white/14 text-[10px] font-mono tracking-wider">
            {app.id.slice(0, 8).toUpperCase()}
          </span>
          <Link href={`/track/${app.trackingToken}`}>
            <button className="text-xs font-semibold transition-opacity hover:opacity-60 flex items-center gap-1" style={{ color: AUDI_RED }}>
              Full details
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-28 text-center"
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
        style={{ background: "rgba(187,10,33,0.06)", border: "1px solid rgba(187,10,33,0.1)" }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 4v14M4 11h14" stroke={AUDI_RED} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-white text-xl font-light mb-2">No applications yet</h3>
      <p className="text-white/28 text-sm max-w-xs leading-relaxed mb-8">
        Start your first application to connect with Audi's Innovation Hub and the teams you want to work with.
      </p>
      <Link href="/apply">
        <button
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
          style={{ background: AUDI_RED }}
        >
          Apply now
        </button>
      </Link>
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ApplicantDashboard() {
  const { data: apps, isLoading, error } = useListApplications();
  const { user } = useUser();
  const role = user?.publicMetadata?.["role"] as string | undefined;
  const hasApps = (apps?.length ?? 0) > 0;
  const acceptedCount = apps?.filter(a => a.status === "accepted").length ?? 0;
  const activeCount   = apps?.filter(a => ["pending","routed","shortlisted"].includes(a.status)).length ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "#080812" }}>

      {/* Nav */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(8,8,18,0.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/">
          <span className="flex items-center gap-3 cursor-pointer group">
            <img src="/audi-logo.png" alt="Audi" className="h-6 w-auto" style={{ opacity: 0.78, filter: "brightness(0) invert(1)" }} />
            <span className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold group-hover:text-white/55 transition-colors">
              Innovation Hub
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {role && (
            <span
              className="px-2.5 py-1 text-[10px] font-semibold rounded-sm tracking-wide hidden sm:inline"
              style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
            >
              {role === "audi_staff" ? "Audi Staff" : role === "superuser" ? "Admin" : "Applicant"}
            </span>
          )}
          {hasApps && (
            <Link href="/apply">
              <button className="px-4 py-2 text-xs font-semibold text-white rounded-sm hover:opacity-85 transition-opacity" style={{ background: AUDI_RED }}>
                + New application
              </button>
            </Link>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 pt-24 pb-24">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mb-10"
        >
          <p className="text-[10px] tracking-[0.3em] font-semibold uppercase mb-3" style={{ color: AUDI_RED }}>
            My Applications
          </p>
          <h1 className="text-3xl font-light text-white leading-tight">
            {user?.firstName ? `Welcome back, ${user.firstName}` : "Your dashboard"}
          </h1>
          <p className="text-white/22 text-sm mt-2">
            Track every application you've submitted to Audi's Innovation Hub.
          </p>
        </motion.div>

        {/* Stats */}
        <AnimatePresence>
          {hasApps && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.45 }}
              className="grid grid-cols-3 gap-3 mb-10"
            >
              {[
                { label: "Total",       value: apps!.length },
                { label: "In progress", value: activeCount  },
                { label: "Accepted",    value: acceptedCount },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-sm py-4 px-4 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-2xl font-light text-white mb-0.5">{value}</p>
                  <p className="text-white/22 text-[10px] tracking-[0.1em] uppercase">{label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-28">
            <div className="flex gap-2">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: AUDI_RED }}
                  animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="rounded-sm p-6 text-center" style={{ background: "rgba(187,10,33,0.04)", border: "1px solid rgba(187,10,33,0.1)" }}>
            <p className="text-white/38 text-sm">Failed to load your applications. Please refresh.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && !hasApps && <EmptyState />}

        {/* Cards */}
        {!isLoading && !error && hasApps && (
          <div className="flex flex-col gap-4">
            {apps!.map((app, i) => <AppCard key={app.id} app={app} idx={i} />)}
          </div>
        )}

        {/* Bottom link */}
        {!isLoading && hasApps && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-10 text-center text-white/14 text-xs"
          >
            Want to apply to another department?{" "}
            <Link href="/apply">
              <span className="text-white/30 hover:text-white/55 transition-colors cursor-pointer underline underline-offset-2 decoration-white/20">
                Submit another application
              </span>
            </Link>
          </motion.p>
        )}
      </div>
    </div>
  );
}
