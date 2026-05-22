import { useParams, Link } from "wouter";
import { useTrackApplication } from "@workspace/api-client-react";

const AUDI_RED = "#BB0A21";

const STATUS_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  pending: {
    label: "Under Review",
    color: "rgba(255,200,50,0.9)",
    description: "Your application has been received and is currently being reviewed by our team.",
  },
  routed: {
    label: "Matched",
    color: "rgba(100,180,255,0.9)",
    description: "Your application has been analysed and matched with relevant Audi departments.",
  },
  shortlisted: {
    label: "Shortlisted",
    color: "rgba(120,220,130,0.9)",
    description: "Congratulations — your startup has been shortlisted for further consideration.",
  },
  accepted: {
    label: "Accepted",
    color: "rgba(80,200,100,0.9)",
    description: "Welcome to the Audi Innovation Hub! Your application has been accepted.",
  },
  declined: {
    label: "Not Selected",
    color: "rgba(180,180,180,0.9)",
    description: "Thank you for applying. Unfortunately we are not moving forward at this time.",
  },
  archived: {
    label: "Archived",
    color: "rgba(150,150,150,0.9)",
    description: "This application has been archived.",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "rgba(200,200,200,0.8)", description: "" };
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-widest"
        style={{ background: `${cfg.color}18`, border: `1.5px solid ${cfg.color}`, color: cfg.color }}>
        {cfg.label}
      </div>
      {cfg.description && (
        <p className="text-white/40 text-sm text-center max-w-xs leading-relaxed">{cfg.description}</p>
      )}
    </div>
  );
}

function CopyButton({ url }: { url: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-medium text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70 transition-all"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3 9H2a1 1 0 01-1-1V2a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      Copy link
    </button>
  );
}

export default function Track() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const { data, isLoading, isError } = useTrackApplication(token);

  const trackUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-20"
      style={{ background: "linear-gradient(135deg, #0A0A14 0%, #0D0B1C 50%, #0A0A14 100%)" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,10,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/">
          <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold hover:text-white/70 transition-colors cursor-pointer">
            ← Audi Innovation Hub
          </span>
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: `${AUDI_RED} transparent transparent transparent` }} />
          <p className="text-white/30 text-sm">Loading application status…</p>
        </div>
      )}

      {isError && (
        <div className="max-w-md w-full text-center" style={{ animation: "fadeUp 0.5s ease forwards" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            </svg>
          </div>
          <p className="text-white/60 text-lg font-light mb-2">Application not found</p>
          <p className="text-white/30 text-sm">This tracking link may be invalid or expired.</p>
          <Link href="/">
            <button className="mt-8 px-6 py-3 text-sm font-semibold text-white/60 border border-white/10 rounded-sm hover:border-white/20 transition-colors">
              ← Back to Hub
            </button>
          </Link>
        </div>
      )}

      {data && (
        <div className="max-w-2xl w-full" style={{ animation: "fadeUp 0.6s ease forwards" }}>
          <div className="text-center mb-10">
            <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-4" style={{ color: AUDI_RED }}>
              Application Status
            </p>
            <h1 className="text-3xl md:text-4xl font-light text-white leading-tight mb-2">
              <span className="font-semibold">{data.companyName}</span>
            </h1>
            <p className="text-white/30 text-sm mb-6">
              Submitted {new Date(data.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <StatusBadge status={data.status} />
          </div>

          {data.departmentScores && data.departmentScores.length > 0 && (
            <div className="mb-10">
              <p className="text-white/30 text-xs tracking-[0.2em] uppercase font-semibold mb-5 text-center">
                Department matches
              </p>
              <div className="space-y-3">
                {[...data.departmentScores]
                  .sort((a, b) => b.score - a.score)
                  .map((d) => (
                    <div
                      key={d.departmentId}
                      className="flex items-center gap-4 p-4 rounded-sm"
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

          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-white/20 text-xs">Share your tracking link</p>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-sm w-full max-w-sm"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-white/30 text-xs flex-1 truncate font-mono">{trackUrl}</p>
              <CopyButton url={trackUrl} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
