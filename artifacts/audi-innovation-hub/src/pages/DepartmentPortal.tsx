import { useState, useCallback } from "react";
import { Link, useParams } from "wouter";
import {
  useListApplications,
  useUpdateApplication,
  getListApplicationsQueryKey,
  ApplicationUpdateInputStatus,
} from "@workspace/api-client-react";
import type { ApplicationSummary, DepartmentScore } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const AUDI_RED = "#BB0A21";
const SCORE_THRESHOLD = 50;
const DEPT_KEY_STORAGE = "dept_portal_key";

function getDeptKey(): string | null {
  try {
    return localStorage.getItem(DEPT_KEY_STORAGE);
  } catch {
    return null;
  }
}

function setDeptKey(key: string) {
  try {
    localStorage.setItem(DEPT_KEY_STORAGE, key);
  } catch {
    /* ignore */
  }
}

function clearDeptKey() {
  try {
    localStorage.removeItem(DEPT_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

function KeyGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError("Please enter the department key.");
      return;
    }
    setDeptKey(value.trim());
    onUnlock();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0A0A14" }}>
      <div
        className="w-full max-w-sm p-8 rounded-sm"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-4" style={{ color: AUDI_RED }}>
          Department Portal
        </p>
        <h1 className="text-2xl font-light text-white mb-2">
          Enter <span className="font-semibold">Access Key</span>
        </h1>
        <p className="text-white/35 text-sm mb-8">
          Department actions require an authorisation key.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            placeholder="Department key"
            className="w-full px-4 py-3 text-sm rounded-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${error ? "rgba(187,10,33,0.5)" : "rgba(255,255,255,0.1)"}`,
              color: "rgba(255,255,255,0.85)",
            }}
          />
          {error && <p className="text-xs" style={{ color: AUDI_RED }}>{error}</p>}
          <button
            type="submit"
            className="w-full py-3 text-sm font-semibold text-white rounded-sm transition-opacity hover:opacity-85"
            style={{ background: AUDI_RED }}>
            Unlock Portal
          </button>
        </form>
      </div>
    </div>
  );
}

const DEPARTMENTS = [
  { id: "production", name: "Production & Manufacturing" },
  { id: "rd", name: "Research & Development" },
  { id: "design", name: "Design Studio" },
  { id: "logistics", name: "Logistics & Supply Chain" },
  { id: "sales", name: "Sales & Customer Experience" },
  { id: "digital", name: "Digital & IT" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:  { label: "In Analyse",  color: "#d97706" },
    analyzed: { label: "Analysiert",  color: "#3b82f6" },
    assigned: { label: "Zugewiesen",  color: "#8b5cf6" },
    approved: { label: "Erstkontakt", color: "#059669" },
    declined: { label: "Abgelehnt",   color: "#dc2626" },
    archived: { label: "Archiviert",  color: "#6b7280" },
  };
  const { label, color } = map[status] ?? { label: status, color: "#6b7280" };
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}>
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 h-1 rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${score}%`,
            background:
              score >= 70
                ? AUDI_RED
                : score >= 40
                  ? "#d97706"
                  : "rgba(255,255,255,0.2)",
          }}
        />
      </div>
      <span className="text-sm font-semibold text-white/70 w-8 text-right">
        {score}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="p-5 rounded-sm"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}>
      <p className="text-white/35 text-xs tracking-[0.15em] uppercase font-semibold mb-2">
        {label}
      </p>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ApplicationRow({
  app,
  deptScore,
  departmentId,
  deptKey,
  onAuthError,
}: {
  app: ApplicationSummary;
  deptScore: DepartmentScore;
  departmentId: string;
  deptKey: string;
  onAuthError: () => void;
}) {
  const queryClient = useQueryClient();
  const authHeaders = { authorization: `Bearer ${deptKey}` };
  const updateMutation = useUpdateApplication({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListApplicationsQueryKey(),
        });
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (status === 401) onAuthError();
      },
    },
    request: { headers: authHeaders },
  });

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesValue, setNotesValue] = useState(app.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);

  const handleStatus = (status: ApplicationUpdateInputStatus) => {
    updateMutation.mutate({ id: app.id, data: { status } });
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    updateMutation.mutate(
      { id: app.id, data: { notes: notesValue } },
      { onSettled: () => setNotesSaving(false) },
    );
  };

  const isPending = updateMutation.isPending;

  return (
    <div
      className="p-5 rounded-sm"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Link href={`/applications/${app.id}`}>
              <span className="text-white font-semibold text-base hover:text-white/80 transition-colors cursor-pointer">
                {app.companyName}
              </span>
            </Link>
            <StatusBadge status={app.status} />
          </div>
          <div className="flex items-center gap-3 text-white/30 text-xs">
            {app.stage && <span>{app.stage}</span>}
            {app.website && (
              <a
                href={app.website}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white/60 transition-colors underline underline-offset-2 truncate max-w-xs">
                {app.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p
            className="text-lg font-semibold"
            style={{ color: AUDI_RED }}>
            {deptScore.score}
            <span className="text-white/20 text-xs font-normal">/100</span>
          </p>
        </div>
      </div>

      <div className="mb-4">
        <ScoreBar score={deptScore.score} />
      </div>

      {deptScore.justification && (
        <p className="text-white/35 text-xs leading-relaxed mb-4">
          {deptScore.justification}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <ActionButton
          label="Zuweisen"
          active={app.status === "assigned"}
          color="#8b5cf6"
          onClick={() => handleStatus(ApplicationUpdateInputStatus.assigned)}
          disabled={isPending}
        />
        <ActionButton
          label="Erstkontakt"
          active={app.status === "approved"}
          color="#059669"
          onClick={() => handleStatus(ApplicationUpdateInputStatus.approved)}
          disabled={isPending}
        />
        <ActionButton
          label="Decline"
          active={app.status === "declined"}
          color="#dc2626"
          onClick={() => handleStatus(ApplicationUpdateInputStatus.declined)}
          disabled={isPending}
        />
        <button
          onClick={() => setNotesOpen((v) => !v)}
          className="px-3 py-1.5 text-xs font-semibold rounded transition-[background-color,transform] duration-150 active:scale-[0.97] ml-auto"
          style={{
            background: notesOpen
              ? "rgba(255,255,255,0.1)"
              : "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
          {notesOpen ? "Hide Notes" : "Notes"}
          {app.notes && !notesOpen && (
            <span
              className="ml-1.5 w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: AUDI_RED }}
            />
          )}
        </button>
      </div>

      {notesOpen && (
        <div className="mt-3">
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Add department notes…"
            rows={3}
            className="w-full text-sm rounded-sm resize-none outline-none transition-colors p-3"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.75)",
            }}
          />
          <div className="flex items-center justify-between mt-2">
            {app.notes && (
              <p className="text-white/20 text-xs">Previously saved</p>
            )}
            <button
              onClick={handleSaveNotes}
              disabled={notesSaving || isPending}
              className="ml-auto px-3 py-1.5 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: AUDI_RED }}>
              {notesSaving ? "Saving…" : "Save Notes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  active,
  color,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 text-xs font-semibold rounded transition-[background-color,color,border-color,transform] duration-150 disabled:opacity-50 active:scale-[0.97]"
      style={{
        background: active ? `${color}33` : "rgba(255,255,255,0.05)",
        color: active ? color : "rgba(255,255,255,0.45)",
        border: `1px solid ${active ? `${color}55` : "rgba(255,255,255,0.08)"}`,
      }}>
      {label}
    </button>
  );
}

export function DepartmentsList() {
  const [locked, setLocked] = useState(() => !getDeptKey());
  const handleUnlock = useCallback(() => setLocked(false), []);
  const handleAuthError = useCallback(() => { clearDeptKey(); setLocked(true); }, []);

  const { data: apps } = useListApplications();

  const getDeptStats = (deptId: string) => {
    if (!apps) return { count: 0, topScore: 0 };
    let count = 0;
    let topScore = 0;
    for (const app of apps) {
      const scores = (app.departmentScores ?? []) as DepartmentScore[];
      const score = scores.find((s) => s.departmentId === deptId);
      if (score && score.score >= SCORE_THRESHOLD) {
        count++;
        if (score.score > topScore) topScore = score.score;
      }
    }
    return { count, topScore };
  };

  if (locked) return <KeyGate onUnlock={handleUnlock} />;

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
        <button
          onClick={() => { clearDeptKey(); setLocked(true); }}
          className="text-white/25 text-xs hover:text-white/50 transition-colors">
          Sign out
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <p
          className="text-xs tracking-[0.25em] font-semibold uppercase mb-4"
          style={{ color: AUDI_RED }}>
          Department Portal
        </p>
        <h1 className="text-3xl md:text-4xl font-light text-white mb-2">
          Select your <span className="font-semibold">Department</span>
        </h1>
        <p className="text-white/35 text-sm mb-12">
          Review and act on startup applications matched to your team.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEPARTMENTS.map((dept) => {
            const stats = getDeptStats(dept.id);
            return (
              <Link key={dept.id} href={`/departments/${dept.id}`}>
                <div
                  className="group p-6 rounded-sm cursor-pointer transition-[border-color,background-color] duration-200 hover:border-white/15"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h2 className="text-white font-semibold text-sm leading-snug">
                      {dept.name}
                    </h2>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 mt-0.5">
                      <path
                        d="M1 7h12M8 2l5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p
                        className="text-xl font-semibold"
                        style={{ color: AUDI_RED }}>
                        {stats.count}
                      </p>
                      <p className="text-white/30 text-xs mt-0.5">
                        matched apps
                      </p>
                    </div>
                    {stats.topScore > 0 && (
                      <div>
                        <p className="text-xl font-semibold text-white">
                          {stats.topScore}
                        </p>
                        <p className="text-white/30 text-xs mt-0.5">
                          top score
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DepartmentView() {
  const [locked, setLocked] = useState(() => !getDeptKey());
  const handleUnlock = useCallback(() => setLocked(false), []);
  const handleAuthError = useCallback(() => { clearDeptKey(); setLocked(true); }, []);

  const { departmentId } = useParams<{ departmentId: string }>();
  const { data: apps, isLoading, error } = useListApplications();

  const dept = DEPARTMENTS.find((d) => d.id === departmentId);
  const deptName = dept?.name ?? departmentId ?? "Department";

  if (locked) return <KeyGate onUnlock={handleUnlock} />;

  const matched = (apps ?? [])
    .map((app) => {
      const scores = (app.departmentScores ?? []) as DepartmentScore[];
      const score = scores.find((s) => s.departmentId === departmentId);
      return score && score.score >= SCORE_THRESHOLD
        ? { app, score }
        : null;
    })
    .filter(Boolean) as { app: ApplicationSummary; score: DepartmentScore }[];

  matched.sort((a, b) => b.score.score - a.score.score);

  const totalCount = matched.length;
  const shortlistedCount = matched.filter(
    ({ app }) => app.status === "assigned",
  ).length;
  const acceptedCount = matched.filter(
    ({ app }) => app.status === "approved",
  ).length;
  const topScore = matched[0]?.score.score ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "#0A0A14" }}>
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,20,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
        <Link href="/departments">
          <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold hover:text-white/70 transition-colors cursor-pointer">
            ← All Departments
          </span>
        </Link>
        <button
          onClick={() => { clearDeptKey(); setLocked(true); }}
          className="text-white/25 text-xs hover:text-white/50 transition-colors">
          Sign out
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <p
          className="text-xs tracking-[0.25em] font-semibold uppercase mb-4"
          style={{ color: AUDI_RED }}>
          Department Portal
        </p>
        <h1 className="text-3xl md:text-4xl font-light text-white mb-2">
          <span className="font-semibold">{deptName}</span>
        </h1>
        <p className="text-white/35 text-sm mb-10">
          Applications with a relevance score ≥ {SCORE_THRESHOLD}.
        </p>

        {!isLoading && apps && (
          <div className="grid grid-cols-3 gap-4 mb-12">
            <StatCard label="Matched" value={totalCount} />
            <StatCard label="Shortlisted" value={shortlistedCount} />
            <StatCard
              label="Top Score"
              value={topScore > 0 ? `${topScore}/100` : "—"}
            />
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{
                borderColor: `${AUDI_RED} transparent transparent transparent`,
              }}
            />
          </div>
        )}

        {error && (
          <div
            className="p-6 rounded-sm text-red-400 text-sm"
            style={{
              background: "rgba(187,10,33,0.1)",
              border: "1px solid rgba(187,10,33,0.2)",
            }}>
            Failed to load applications. Is the API server running?
          </div>
        )}

        {!isLoading && matched.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/30 text-sm">
              No applications matched this department yet (score ≥{" "}
              {SCORE_THRESHOLD}).
            </p>
          </div>
        )}

        {matched.length > 0 && (
          <div className="space-y-4">
            {matched.map(({ app, score }) => (
              <ApplicationRow
                key={app.id}
                app={app}
                deptScore={score}
                departmentId={departmentId ?? ""}
                deptKey={getDeptKey() ?? ""}
                onAuthError={handleAuthError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
