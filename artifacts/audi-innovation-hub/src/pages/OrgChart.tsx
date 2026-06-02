import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { UserButton, useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListApplications,
  useUpdateApplication,
  getListApplicationsQueryKey,
} from "@workspace/api-client-react";
import type { ApplicationSummary } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

const AUDI_RED = "#BB0A21";

// ─── Types ────────────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { id: "production", name: "Production & Manufacturing" },
  { id: "rd",         name: "Research & Development" },
  { id: "design",     name: "Design Studio" },
  { id: "logistics",  name: "Logistics & Supply Chain" },
  { id: "sales",      name: "Sales & Customer Experience" },
  { id: "digital",    name: "Digital & IT" },
] as const;

const DEPT_MAP: Record<string, string> = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d.name]));

interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  role: string | null;
  departmentId?: string | null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "In Analyse",  color: "#d97706", bg: "rgba(217,119,6,0.12)"   },
  analyzed: { label: "Analysiert",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  assigned: { label: "Zugewiesen",  color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  approved: { label: "Erstkontakt", color: "#16a34a", bg: "rgba(22,163,74,0.12)"   },
  declined: { label: "Abgelehnt",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  archived: { label: "Archiviert",  color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────
function AssignModal({
  staff,
  apps,
  onClose,
  onAssign,
  assigning,
}: {
  staff: StaffUser;
  apps: ApplicationSummary[];
  onClose: () => void;
  onAssign: (appId: string, dept: string) => void;
  assigning: string | null;
}) {
  // Default filter = analyzed (most relevant to assign)
  const [filter, setFilter] = useState<"all" | "pending" | "analyzed">("analyzed");
  const [search, setSearch] = useState("");
  // Pre-fill dept from staff's persistent departmentId
  const [dept, setDept] = useState(staff.departmentId ?? "");

  const staffName = `${staff.firstName} ${staff.lastName}`.trim() || staff.email;
  const hasDept = !!staff.departmentId;

  const visible = apps
    .filter(a => {
      const notThisStaff = a.assignedEmployee?.clerkId !== staff.id;
      const matchFilter =
        filter === "all" ||
        (filter === "pending"  && a.status === "pending") ||
        (filter === "analyzed" && a.status === "analyzed");
      const matchSearch = !search || a.companyName.toLowerCase().includes(search.toLowerCase());
      return notThisStaff && matchFilter && matchSearch;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-xl rounded-sm overflow-hidden flex flex-col"
        style={{ background: "#0f0f1e", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "82vh" }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: AUDI_RED }}>
              Bewerbung zuweisen
            </p>
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold text-sm">{staffName}</p>
              {hasDept && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}
                >
                  {DEPT_MAP[staff.departmentId!] ?? staff.departmentId}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded transition-[background-color] duration-150 hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Department select — only if not pre-filled */}
        {!hasDept && (
          <div className="px-5 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wide mb-1.5">
              Abteilung für diese Zuweisung
            </p>
            <select
              value={dept}
              onChange={e => setDept(e.target.value)}
              className="w-full px-3 py-2 rounded-sm text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <option value="">— Abteilung wählen —</option>
              {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {/* Search + filter */}
        <div className="px-5 pt-3 pb-3 flex gap-2 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Startup suchen…"
            className="flex-1 px-3 py-1.5 rounded-sm text-sm text-white placeholder-white/25 outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          {(["analyzed", "all", "pending"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[background-color,color] duration-150"
              style={{
                background: filter === f ? AUDI_RED : "rgba(255,255,255,0.05)",
                color:      filter === f ? "#fff"    : "rgba(255,255,255,0.4)",
                border: `1px solid ${filter === f ? AUDI_RED : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {f === "all" ? "Alle" : f === "pending" ? "Pending" : "Analysiert"}
            </button>
          ))}
        </div>

        {/* App list */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-6">
              <p className="text-white/25 text-sm">Keine Bewerbungen gefunden.</p>
              <p className="text-white/15 text-xs mt-1">
                {filter !== "all" ? 'Filter auf "Alle" setzen oder Suche leeren.' : "Alle Bewerbungen sind bereits zugewiesen."}
              </p>
            </div>
          ) : (
            visible.map((app, i) => {
              const isAssigning = assigning === app.id;
              // Show relevance score for this staff member's department
              const deptScore = staff.departmentId
                ? (app.departmentScores ?? []).find((s: { departmentId: string; score: number }) => s.departmentId === staff.departmentId)
                : null;
              return (
                <button
                  key={app.id}
                  onClick={() => onAssign(app.id, dept)}
                  disabled={!!assigning}
                  className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 transition-[background-color] duration-150 hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ borderBottom: i < visible.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{app.companyName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {app.stage && <span className="text-white/30 text-xs">{app.stage}</span>}
                      {app.assignedEmployee?.name && (
                        <span className="text-white/25 text-xs">· aktuell: {app.assignedEmployee.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {deptScore && (
                      <span
                        className="text-xs font-bold tabular-nums px-2 py-0.5 rounded"
                        style={{
                          color:      deptScore.score >= 70 ? AUDI_RED : "rgba(255,255,255,0.35)",
                          background: deptScore.score >= 70 ? "rgba(187,10,33,0.12)" : "rgba(255,255,255,0.05)",
                          border:     `1px solid ${deptScore.score >= 70 ? "rgba(187,10,33,0.25)" : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        {deptScore.score}
                      </span>
                    )}
                    <StatusBadge status={app.status} />
                    {isAssigning ? (
                      <div className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
                        style={{ borderColor: `${AUDI_RED} transparent transparent transparent` }} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 opacity-25">
                        <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/25 text-xs">{visible.length} Bewerbung{visible.length !== 1 ? "en" : ""} verfügbar</p>
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-sm transition-[background-color] duration-150 hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
            Schließen
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────
function StaffCard({
  staff,
  assignedApps,
  onAssignClick,
  onDeptAssignClick,
}: {
  staff: StaffUser;
  assignedApps: ApplicationSummary[];
  onAssignClick: (staff: StaffUser) => void;
  onDeptAssignClick: (staff: StaffUser) => void;
}) {
  const staffName = `${staff.firstName} ${staff.lastName}`.trim() || staff.email;
  const initials = staffName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-sm overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Card header */}
      <div className="p-4 flex items-start gap-3">
        {staff.imageUrl ? (
          <img src={staff.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 opacity-90" />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "rgba(187,10,33,0.15)", color: AUDI_RED }}>
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold text-sm truncate">{staffName}</p>
          <p className="text-white/35 text-xs truncate mt-0.5">{staff.email}</p>
          <p className="text-white/20 text-[10px] mt-1.5">
            {assignedApps.length} Bewerbung{assignedApps.length !== 1 ? "en" : ""} zugewiesen
          </p>
        </div>
        {/* ⋯ dept-change button */}
        <button
          onClick={() => onDeptAssignClick(staff)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-[background-color] duration-150 hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.25)" }}
          title="Abteilung ändern"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="3"  r="1" fill="currentColor" />
            <circle cx="7" cy="7"  r="1" fill="currentColor" />
            <circle cx="7" cy="11" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Assigned apps preview */}
      {assignedApps.length > 0 ? (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Zugewiesen</p>
          {assignedApps.slice(0, 3).map(app => (
            <Link key={app.id} href={`/applications/${app.id}`}>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-sm cursor-pointer transition-[background-color] duration-150 hover:bg-white/5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-white/65 text-xs font-medium truncate flex-1 mr-2">{app.companyName}</p>
                <StatusBadge status={app.status} />
              </div>
            </Link>
          ))}
          {assignedApps.length > 3 && (
            <p className="text-white/20 text-[10px] pl-1">+{assignedApps.length - 3} weitere</p>
          )}
        </div>
      ) : (
        <div className="px-4 pb-3">
          <p className="text-white/15 text-xs italic">Noch keine Bewerbungen zugewiesen</p>
        </div>
      )}

      {/* Single action button */}
      <div className="mt-auto px-4 pb-4">
        <button
          onClick={() => onAssignClick(staff)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-sm text-xs font-semibold text-white transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.98]"
          style={{ background: AUDI_RED }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Bewerbung zuweisen
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORG CHART PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function OrgChart() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeDept, setActiveDept] = useState<string>("production");
  const [modalStaff, setModalStaff] = useState<StaffUser | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dept assignment modal
  const [deptModalStaff, setDeptModalStaff] = useState<StaffUser | null>(null);
  const [deptSelected, setDeptSelected] = useState<string>("");
  const [deptSaving, setDeptSaving] = useState(false);

  const { data: apps = [], isLoading: appsLoading } = useListApplications();

  const { mutate: patchApp } = useUpdateApplication({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListApplicationsQueryKey() }); },
    },
  });

  // Load staff users
  useEffect(() => {
    getToken()
      .then(token => fetch("/api/admin/users", { headers: token ? { Authorization: `Bearer ${token}` } : {} }))
      .then(r => r.json())
      .then((users: (StaffUser & { role?: string })[]) =>
        setStaffUsers(users.filter((u: StaffUser) => u.role === "audi_staff"))
      )
      .catch(console.error)
      .finally(() => setStaffLoading(false));
  }, [getToken]);

  const handleAssign = useCallback(
    (appId: string, dept: string) => {
      if (!modalStaff) return;
      setAssigning(appId);
      const staffName = `${modalStaff.firstName} ${modalStaff.lastName}`.trim() || modalStaff.email;
      patchApp(
        {
          id: appId,
          data: {
            assignedEmployee: {
              name:       staffName,
              role:       "Audi Staff",
              email:      modalStaff.email,
              department: dept ? (DEPT_MAP[dept] ?? dept) : "Audi",
              clerkId:    modalStaff.id,
            },
          } as unknown as Parameters<typeof patchApp>[0]["data"],
        },
        {
          onSuccess: () => {
            setAssigning(null);
            setModalStaff(null);
            setSuccessMsg(`Bewerbung erfolgreich an ${staffName} zugewiesen.`);
            setTimeout(() => setSuccessMsg(null), 3000);
          },
          onError: () => setAssigning(null),
        }
      );
    },
    [modalStaff, patchApp]
  );

  const handleOpenDeptModal = useCallback((staff: StaffUser) => {
    setDeptModalStaff(staff);
    setDeptSelected(staff.departmentId ?? "");
  }, []);

  const handleSaveDept = useCallback(async () => {
    if (!deptModalStaff) return;
    setDeptSaving(true);
    try {
      const token = await getToken();
      await fetch(`/api/admin/users/${deptModalStaff.id}/department`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ departmentId: deptSelected || null }),
      });
      setStaffUsers(prev => prev.map(u => u.id === deptModalStaff.id ? { ...u, departmentId: deptSelected || null } : u));
      const deptName = deptSelected ? (DEPT_MAP[deptSelected] ?? deptSelected) : null;
      setSuccessMsg(deptName
        ? `${deptModalStaff.firstName || deptModalStaff.email} wurde „${deptName}" zugeordnet.`
        : `Abteilungszuordnung für ${deptModalStaff.firstName || deptModalStaff.email} entfernt.`
      );
      setTimeout(() => setSuccessMsg(null), 3000);
      setDeptModalStaff(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeptSaving(false);
    }
  }, [deptModalStaff, deptSelected, getToken]);

  // ── Computed values ──
  const staffByDept     = (id: string) => staffUsers.filter(u => u.departmentId === id);
  const assignedByDept  = (id: string) => apps.filter(a => staffUsers.some(u => u.departmentId === id && a.assignedEmployee?.clerkId === u.id));
  const unassignedStaff = staffUsers.filter(u => !u.departmentId);

  const activeStaff = (activeDept === "unassigned" ? unassignedStaff : staffUsers.filter(u => u.departmentId === activeDept))
    .filter(u => {
      if (!search) return true;
      const name = `${u.firstName} ${u.lastName}`.toLowerCase();
      return name.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    });

  const totalAssigned   = apps.filter(a =>  !!a.assignedEmployee?.clerkId).length;
  const totalUnassigned = apps.filter(a => !a.assignedEmployee?.clerkId).length;
  const isLoading = staffLoading || appsLoading;

  return (
    <div className="min-h-screen" style={{ background: "#0A0A14" }}>
      {/* Nav */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link href="/admin">
          <span className="flex items-center gap-3 cursor-pointer group">
            <img src="/audi-logo.png" alt="Audi" className="h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold group-hover:text-white/70 transition-colors">
              Innovation Hub
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/applications">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97] hidden sm:inline-flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1.5 3h9M1.5 6h9M1.5 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Bewerbungen
            </button>
          </Link>
          <Link href="/admin">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97] hidden sm:inline-flex items-center gap-1.5"
              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
              ← Admin
            </button>
          </Link>
          <span className="px-2.5 py-1 text-[10px] font-semibold rounded-sm hidden sm:inline"
            style={{ color: "rgba(245,158,11,0.85)", border: "1px solid rgba(245,158,11,0.22)", background: "rgba(245,158,11,0.07)" }}>
            Superuser ⚡
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">

        {/* Header + inline stats */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] tracking-[0.28em] font-semibold uppercase mb-1.5" style={{ color: "#f59e0b" }}>
              Superuser · Team-Übersicht
            </p>
            <h1 className="text-3xl md:text-4xl font-light text-white leading-tight">
              Mitarbeiter <span className="font-semibold">Organigramm</span>
            </h1>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: "Mitarbeiter",       value: staffUsers.length, color: "rgba(255,255,255,0.7)" },
              { label: "Apps zugewiesen",   value: totalAssigned,     color: "#16a34a" },
              { label: "Nicht zugewiesen",  value: totalUnassigned,   color: "#d97706" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-semibold leading-none" style={{ color }}>{value}</p>
                <p className="text-white/25 text-[10px] mt-0.5 tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: `${AUDI_RED} transparent transparent transparent` }} />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && staffUsers.length === 0 && (
          <div className="text-center py-24">
            <p className="text-white/30 text-sm mb-2">Noch keine Audi-Staff-Mitarbeiter angelegt.</p>
            <Link href="/admin">
              <span className="text-white/25 text-xs underline cursor-pointer hover:text-white/50 transition-colors">
                → Nutzer im Admin-Bereich Rollen zuweisen
              </span>
            </Link>
          </div>
        )}

        {/* Success toast */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 px-4 py-3 rounded-sm flex items-center gap-2"
              style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.25)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7l3 3 6-6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>{successMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two-column layout */}
        {!isLoading && staffUsers.length > 0 && (
          <div className="flex gap-5">

            {/* ── LEFT: Department tabs ── */}
            <div className="flex-shrink-0 w-52">
              <div className="flex flex-col gap-1 sticky top-28">
                {DEPARTMENTS.map(d => {
                  const count    = staffByDept(d.id).length;
                  const assigned = assignedByDept(d.id).length;
                  const isActive = activeDept === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => { setActiveDept(d.id); setSearch(""); }}
                      className="w-full text-left px-3 py-2.5 rounded-sm flex items-center justify-between gap-2 transition-[background-color,border-color] duration-150"
                      style={{
                        background:  isActive ? "rgba(187,10,33,0.08)" : "rgba(255,255,255,0.02)",
                        border:      `1px solid ${isActive ? `${AUDI_RED}33` : "rgba(255,255,255,0.055)"}`,
                        borderLeft:  isActive ? `3px solid ${AUDI_RED}` : "3px solid transparent",
                      }}
                    >
                      <span
                        className="text-xs font-medium leading-snug"
                        style={{ color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)" }}
                      >
                        {d.name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {assigned > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(22,163,74,0.15)", color: "#16a34a" }}>
                            {assigned}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            background: isActive ? "rgba(187,10,33,0.18)" : "rgba(255,255,255,0.06)",
                            color:      isActive ? AUDI_RED              : "rgba(255,255,255,0.28)",
                          }}>
                          {count}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Unassigned tab */}
                {unassignedStaff.length > 0 && (() => {
                  const isActive = activeDept === "unassigned";
                  return (
                    <button
                      onClick={() => { setActiveDept("unassigned"); setSearch(""); }}
                      className="w-full text-left px-3 py-2.5 rounded-sm flex items-center justify-between gap-2 transition-[background-color,border-color] duration-150 mt-1"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.055)"}`,
                        borderLeft: isActive ? "3px solid rgba(255,255,255,0.25)" : "3px solid transparent",
                      }}
                    >
                      <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Nicht zugeordnet
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.28)" }}>
                        {unassignedStaff.length}
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* ── RIGHT: Staff grid ── */}
            <div className="flex-1 min-w-0">
              {/* Panel header + search */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-white font-semibold text-base">
                    {activeDept === "unassigned" ? "Nicht zugeordnet" : (DEPT_MAP[activeDept] ?? activeDept)}
                  </p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {activeStaff.length} Mitarbeiter
                    {activeDept !== "unassigned" && ` · ${assignedByDept(activeDept).length} Bewerbungen zugewiesen`}
                  </p>
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="px-3 py-2 rounded-sm text-sm text-white placeholder-white/25 outline-none w-44"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
                />
              </div>

              {activeStaff.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-white/25 text-sm">
                    {search
                      ? `Kein Mitarbeiter gefunden für „${search}".`
                      : "Keine Mitarbeiter in dieser Abteilung."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeStaff.map(staff => (
                    <StaffCard
                      key={staff.id}
                      staff={staff}
                      assignedApps={apps.filter(a => a.assignedEmployee?.clerkId === staff.id)}
                      onAssignClick={setModalStaff}
                      onDeptAssignClick={handleOpenDeptModal}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <AnimatePresence>
        {modalStaff && (
          <AssignModal
            staff={modalStaff}
            apps={apps}
            onClose={() => setModalStaff(null)}
            onAssign={handleAssign}
            assigning={assigning}
          />
        )}
      </AnimatePresence>

      {/* Dept assignment modal */}
      {deptModalStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setDeptModalStaff(null); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-sm overflow-hidden"
            style={{ background: "#0f0f1e", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase font-semibold mb-0.5" style={{ color: "#60a5fa" }}>
                  Abteilung zuweisen
                </p>
                <p className="text-white font-semibold text-sm">
                  {`${deptModalStaff.firstName} ${deptModalStaff.lastName}`.trim() || deptModalStaff.email}
                </p>
              </div>
              <button onClick={() => setDeptModalStaff(null)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-2">Abteilung</p>
              <select
                value={deptSelected}
                onChange={e => setDeptSelected(e.target.value)}
                className="w-full px-3 py-2.5 rounded-sm text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <option value="">— Keine Abteilung —</option>
                {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button onClick={() => setDeptModalStaff(null)}
                className="px-4 py-2 text-xs font-semibold rounded-sm hover:bg-white/10 transition-colors"
                style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Abbrechen
              </button>
              <button
                onClick={handleSaveDept}
                disabled={deptSaving}
                className="px-4 py-2 text-xs font-semibold text-white rounded-sm transition-[opacity] duration-150 hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#3b82f6" }}
              >
                {deptSaving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
