import { useState } from "react";
import { Link } from "wouter";
import { UserButton, useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

const AUDI_RED = "#BB0A21";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "superuser" | "audi_staff" | "applicant" | null;

interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  createdAt: number;
  lastSignInAt: number | null;
  role: string | null;
}

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; description: string }> = {
  superuser: {
    label: "Superuser",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    description: "Full access — can manage all roles and view admin dashboard",
  },
  audi_staff: {
    label: "Audi Staff",
    color: "#BB0A21",
    bg: "rgba(187,10,33,0.12)",
    description: "Access to application dashboard, ratings, KPIs and next steps",
  },
  applicant: {
    label: "Applicant",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    description: "Can submit and track their own applications",
  },
};

function RoleBadge({ role }: { role: string | null }) {
  if (!role) {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        No role
      </span>
    );
  }
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return null;
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
      {cfg.label}
    </span>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchUsers(token: string | null): Promise<ClerkUser[]> {
  const res = await fetch("/api/admin/users", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function patchUserRole(
  userId: string,
  role: string | null,
  token: string | null,
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role: role ?? "" }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [pendingRole, setPendingRole] = useState<Record<string, string | null>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: users = [], isLoading, error } = useQuery<ClerkUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const token = await getToken();
      return fetchUsers(token);
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string | null }) => {
      const token = await getToken();
      await patchUserRole(userId, role, token);
    },
    onSuccess: (_data, { userId, role }) => {
      // Optimistically update the cache
      qc.setQueryData<ClerkUser[]>(["admin-users"], (prev) =>
        prev?.map((u) => (u.id === userId ? { ...u, role } : u)) ?? [],
      );
      setSaved((s) => ({ ...s, [userId]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [userId]: false })), 2000);
      setPendingRole((p) => { const next = { ...p }; delete next[userId]; return next; });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: (_data, userId) => {
      qc.setQueryData<ClerkUser[]>(["admin-users"], (prev) => prev?.filter((u) => u.id !== userId) ?? []);
      setConfirmDelete(null);
    },
  });

  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || (filterRole === "none" ? !u.role : u.role === filterRole);
    return matchSearch && matchRole;
  });

  const stats = {
    total:     users.length,
    superuser: users.filter(u => u.role === "superuser").length,
    staff:     users.filter(u => u.role === "audi_staff").length,
    applicant: users.filter(u => u.role === "applicant" || !u.role).length,
  };

  return (
    <div className="min-h-screen" style={{ background: "#0A0A14" }}>
      {/* Nav */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/">
          <span className="flex items-center gap-3 cursor-pointer group">
            <img src="/audi-logo.png" alt="Audi" className="h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold group-hover:text-white/70 transition-colors">
              Innovation Hub
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/applications">
            <button className="px-4 py-2 text-xs font-semibold rounded-sm transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Applications
            </button>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs tracking-[0.25em] font-semibold uppercase mb-2" style={{ color: "#f59e0b" }}>
            Superuser
          </p>
          <h1 className="text-3xl md:text-4xl font-light text-white">
            User <span className="font-semibold">Management</span>
          </h1>
          <p className="text-white/30 text-sm mt-1">Assign and manage roles for all users in the system.</p>
        </div>

        {/* Role legend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
            <div key={role} className="p-4 rounded-sm"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                <p className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
              </div>
              <p className="text-white/40 text-xs leading-relaxed">{cfg.description}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Users",  value: stats.total,     color: "rgba(255,255,255,0.6)" },
            { label: "Superusers",   value: stats.superuser, color: "#f59e0b" },
            { label: "Audi Staff",   value: stats.staff,     color: AUDI_RED },
            { label: "Applicants",   value: stats.applicant, color: "#3b82f6" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-sm"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
              <p className="text-white/30 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 px-4 py-2.5 rounded-sm text-sm text-white placeholder-white/25 outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
          />
          <div className="flex gap-2">
            {[
              { value: "all",        label: "All" },
              { value: "superuser",  label: "Superuser" },
              { value: "audi_staff", label: "Staff" },
              { value: "none",       label: "No Role" },
            ].map(({ value, label }) => (
              <button key={value} onClick={() => setFilterRole(value)}
                className="px-3 py-2 text-xs font-semibold rounded-sm transition-all"
                style={{
                  background: filterRole === value ? AUDI_RED : "rgba(255,255,255,0.05)",
                  color: filterRole === value ? "#fff" : "rgba(255,255,255,0.45)",
                  border: `1px solid ${filterRole === value ? AUDI_RED : "rgba(255,255,255,0.08)"}`,
                }}>
                {label}
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
            Failed to load users: {(error as Error).message}
          </div>
        )}

        {/* User table */}
        {!isLoading && !error && (
          <div className="rounded-sm overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold tracking-[0.12em] uppercase text-white/25"
              style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="col-span-1" />
              <span className="col-span-4">User</span>
              <span className="col-span-2">Current Role</span>
              <span className="col-span-3">Assign Role</span>
              <span className="col-span-1">Joined</span>
              <span className="col-span-1 text-right">Actions</span>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white/25 text-sm">No users match your search.</p>
              </div>
            )}

            {filtered.map((user, i) => {
              const currentRole = pendingRole[user.id] !== undefined ? pendingRole[user.id] : user.role;
              const isDirty = pendingRole[user.id] !== undefined && pendingRole[user.id] !== user.role;
              const isSaving = roleMutation.isPending && roleMutation.variables?.userId === user.id;

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-12 gap-4 px-5 py-4 items-center"
                  style={{
                    background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {/* Avatar */}
                  <div className="col-span-1">
                    {user.imageUrl ? (
                      <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover opacity-80" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white/50"
                        style={{ background: "rgba(255,255,255,0.08)" }}>
                        {(user.firstName[0] ?? user.email[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name + email */}
                  <div className="col-span-4">
                    <p className="text-white text-sm font-medium truncate">
                      {user.firstName || user.lastName
                        ? `${user.firstName} ${user.lastName}`.trim()
                        : "—"}
                    </p>
                    <p className="text-white/35 text-xs truncate mt-0.5">{user.email}</p>
                  </div>

                  {/* Current role badge */}
                  <div className="col-span-2">
                    <RoleBadge role={user.role} />
                  </div>

                  {/* Role selector */}
                  <div className="col-span-3 flex items-center gap-2">
                    <select
                      value={currentRole ?? ""}
                      onChange={e => setPendingRole(p => ({ ...p, [user.id]: e.target.value || null }))}
                      disabled={isSaving}
                      className="flex-1 px-3 py-1.5 rounded-sm text-xs text-white outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid ${isDirty ? "#f59e0b66" : "rgba(255,255,255,0.1)"}`,
                      }}
                    >
                      <option value="">No role</option>
                      <option value="applicant">Applicant</option>
                      <option value="audi_staff">Audi Staff</option>
                      <option value="superuser">Superuser</option>
                    </select>

                    {isDirty && (
                      <button
                        onClick={() => roleMutation.mutate({ userId: user.id, role: currentRole ?? null })}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-all whitespace-nowrap"
                        style={{ background: AUDI_RED, color: "#fff" }}
                      >
                        {isSaving ? "…" : "Save"}
                      </button>
                    )}

                    {saved[user.id] && !isDirty && (
                      <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>✓ Saved</span>
                    )}
                  </div>

                  {/* Joined */}
                  <div className="col-span-1">
                    <span className="text-white/20 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                    </span>
                  </div>

                  {/* Delete */}
                  <div className="col-span-1 flex justify-end">
                    {confirmDelete === user.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(user.id)}
                          disabled={deleteMutation.isPending}
                          className="px-2 py-1 text-xs font-semibold rounded text-white"
                          style={{ background: AUDI_RED }}
                        >
                          {deleteMutation.isPending ? "…" : "Yes"}
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 text-xs rounded text-white/40 hover:text-white/70 transition-colors">
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(user.id)}
                        className="text-white/15 hover:text-red-400 transition-colors text-xs"
                        title="Delete user"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M1.5 3.5h11M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M3 3.5l.7 8.5a.5.5 0 0 0 .5.5h5.6a.5.5 0 0 0 .5-.5L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* How to become superuser note */}
        <div className="mt-8 p-5 rounded-sm"
          style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <p className="text-amber-400/80 text-xs font-semibold mb-1 uppercase tracking-wide">First-time setup</p>
          <p className="text-white/40 text-xs leading-relaxed">
            To grant yourself superuser access for the first time, go to{" "}
            <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer"
              className="underline text-amber-400/60 hover:text-amber-400 transition-colors">
              dashboard.clerk.com
            </a>
            {" → "}Users → select your user → Edit public metadata → set{" "}
            <code className="px-1.5 py-0.5 rounded text-amber-300/70"
              style={{ background: "rgba(245,158,11,0.1)", fontFamily: "monospace" }}>
              {"{ \"role\": \"superuser\" }"}
            </code>
            . After that, all role management happens here.
          </p>
        </div>
      </div>
    </div>
  );
}
