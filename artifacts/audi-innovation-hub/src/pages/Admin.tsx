import { useState, useEffect } from "react";
import { Link } from "wouter";
import { UserButton, useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListApplications } from "@workspace/api-client-react";
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
  departmentId: string | null;
}

const DEPARTMENTS = [
  { id: "production", name: "Production & Manufacturing" },
  { id: "rd",         name: "Research & Development" },
  { id: "design",     name: "Design Studio" },
  { id: "logistics",  name: "Logistics & Supply Chain" },
  { id: "sales",      name: "Sales & Customer Experience" },
  { id: "digital",    name: "Digital & IT" },
] as const;

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

async function patchUserDept(
  userId: string,
  departmentId: string | null,
  token: string | null,
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/department`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ departmentId: departmentId ?? null }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Analysis prompt default (mirrors backend hub-config-defaults.ts) ────────
const DEFAULT_ANALYSIS_PROMPT = `You are an expert innovation analyst at Audi AG. You have just reviewed a startup application interview transcript for the Audi Innovation Hub program.

Company: {{companyName}}

Interview Transcript:
{{transcriptText}}

Your task is to analyze this startup and return a JSON response with exactly this structure:

{
  "structuredData": {
    "companyName": "...",
    "problemStatement": "...",
    "solution": "...",
    "technology": "...",
    "stage": "...",
    "teamSize": "...",
    "traction": "...",
    "targetCollaboration": "...",
    "pitchDeckUrl": "...",
    "website": "..."
  },
  "departmentScores": [
    {{departmentsList}}
  ],
  "businessCases": [
    {
      "departmentId": "<id of top 2 departments by score>",
      "departmentName": "<name>",
      "brief": "<200-word business case brief explaining why this startup would be valuable for this Audi department, what the collaboration could look like, and what business outcomes are possible>"
    }
  ]
}

Scoring guidelines:
- Score 0-100 on how relevant this startup is for each department
- Consider technology fit, use cases, and potential for pilot projects
- Only include business cases for the top 2 scoring departments

Return ONLY the JSON object, no markdown, no explanation.`;

// ─── Config types + helpers ───────────────────────────────────────────────────
interface FocusArea { title: string; topics: string[]; isWildcard?: boolean }
interface HubConfig {
  focus_areas: FocusArea[];
  chat_questions: Record<string, string>;
  chat_system_prompt: { intro: string };
  analysis_prompt: string;
}

const CHAT_FIELD_LABELS: Record<string, string> = {
  companyName: "Company Name",
  problem: "Problem & Customers",
  solution: "Solution",
  technology: "Technology",
  stage: "Stage",
  teamSize: "Team Size",
  targetDepartments: "Target Departments",
};

async function fetchConfig(token: string | null): Promise<HubConfig> {
  const res = await fetch("/api/admin/config", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putConfig(key: string, value: unknown, token: string | null): Promise<void> {
  const res = await fetch(`/api/admin/config/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ value }),
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
  const [pendingDept, setPendingDept] = useState<Record<string, string | null>>({});
  const [savedDept, setSavedDept] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Content management state ──────────────────────────────────────────────
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; topics: string; isWildcard: boolean }>({ title: "", topics: "", isWildcard: false });
  const [savingFocus, setSavingFocus] = useState(false);
  const [focusSavedOk, setFocusSavedOk] = useState(false);

  const [chatQuestions, setChatQuestions] = useState<Record<string, string>>({});
  const [chatIntro, setChatIntro] = useState("");
  const [savingChat, setSavingChat] = useState(false);
  const [chatSavedOk, setChatSavedOk] = useState(false);

  const [analysisPrompt, setAnalysisPrompt] = useState(DEFAULT_ANALYSIS_PROMPT);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSavedOk, setPromptSavedOk] = useState(false);
  const [resettingPrompt, setResettingPrompt] = useState(false);

  // ── Applications overview (superuser can see all) ──────────────────────────
  const { data: apps = [] } = useListApplications();
  const appStats = {
    total:       apps.length,
    pending:     apps.filter(a => a.status === "pending" || a.status === "analyzed").length,
    shortlisted: apps.filter(a => a.status === "assigned").length,
    accepted:    apps.filter(a => a.status === "approved").length,
    declined:    apps.filter(a => a.status === "declined" || a.status === "archived").length,
  };

  const { data: users = [], isLoading, error } = useQuery<ClerkUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const token = await getToken();
      return fetchUsers(token);
    },
  });

  const { data: configData } = useQuery<HubConfig>({
    queryKey: ["admin-config"],
    queryFn: async () => {
      const token = await getToken();
      return fetchConfig(token);
    },
  });

  // Populate editing state once config loads
  useEffect(() => {
    if (!configData) return;
    setFocusAreas(configData.focus_areas ?? []);
    setChatQuestions(configData.chat_questions ?? {});
    setChatIntro(configData.chat_system_prompt?.intro ?? "");
    setAnalysisPrompt(configData.analysis_prompt ?? "");
  }, [configData]);

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

  const deptMutation = useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: string; departmentId: string | null }) => {
      const token = await getToken();
      await patchUserDept(userId, departmentId, token);
    },
    onSuccess: (_data, { userId, departmentId }) => {
      qc.setQueryData<ClerkUser[]>(["admin-users"], (prev) =>
        prev?.map((u) => (u.id === userId ? { ...u, departmentId } : u)) ?? [],
      );
      setSavedDept((s) => ({ ...s, [userId]: true }));
      setTimeout(() => setSavedDept((s) => ({ ...s, [userId]: false })), 2000);
      setPendingDept((p) => { const next = { ...p }; delete next[userId]; return next; });
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

  // ── Content save handlers ─────────────────────────────────────────────────
  async function saveFocusAreas() {
    setSavingFocus(true);
    try {
      const token = await getToken();
      await putConfig("focus_areas", focusAreas, token);
      setFocusSavedOk(true);
      setTimeout(() => setFocusSavedOk(false), 2500);
      qc.invalidateQueries({ queryKey: ["admin-config"] });
    } finally {
      setSavingFocus(false);
    }
  }

  async function saveChatConfig() {
    setSavingChat(true);
    try {
      const token = await getToken();
      await Promise.all([
        putConfig("chat_questions", chatQuestions, token),
        putConfig("chat_system_prompt", { intro: chatIntro }, token),
      ]);
      setChatSavedOk(true);
      setTimeout(() => setChatSavedOk(false), 2500);
      qc.invalidateQueries({ queryKey: ["admin-config"] });
    } finally {
      setSavingChat(false);
    }
  }

  async function saveAnalysisPrompt() {
    setSavingPrompt(true);
    try {
      const token = await getToken();
      await putConfig("analysis_prompt", analysisPrompt, token);
      setPromptSavedOk(true);
      setTimeout(() => setPromptSavedOk(false), 2500);
      qc.invalidateQueries({ queryKey: ["admin-config"] });
    } finally {
      setSavingPrompt(false);
    }
  }

  async function resetAnalysisPrompt() {
    setResettingPrompt(true);
    try {
      const token = await getToken();
      // Delete the custom DB row so the server falls back to its built-in default
      await fetch("/api/admin/config/analysis_prompt", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Immediately restore the default in the textarea (no need to refetch)
      setAnalysisPrompt(DEFAULT_ANALYSIS_PROMPT);
      qc.invalidateQueries({ queryKey: ["admin-config"] });
    } finally {
      setResettingPrompt(false);
    }
  }

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
        <div className="flex items-center gap-2">
          <Link href="/applications">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97] hidden sm:inline-flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1.5 3h9M1.5 6h9M1.5 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Applications
            </button>
          </Link>
          <Link href="/departments">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97] hidden sm:inline-flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L10.5 3.5v5L6 11 1.5 8.5v-5L6 1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Departments
            </button>
          </Link>
          <Link href="/org">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97] hidden sm:inline-flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="2.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="9.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6 4.5v2M6 6.5l-3 1M6 6.5l3 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Org Chart
            </button>
          </Link>
          <span className="px-2.5 py-1 text-[10px] font-semibold rounded-sm hidden sm:inline"
            style={{ color: "rgba(245,158,11,0.85)", border: "1px solid rgba(245,158,11,0.22)", background: "rgba(245,158,11,0.07)" }}>
            Superuser ⚡
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        {/* ── Command Center Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mb-10"
        >
          <p className="text-[11px] tracking-[0.28em] font-semibold uppercase mb-2" style={{ color: "#f59e0b" }}>
            Superuser · Command Center
          </p>
          <h1 className="text-3xl md:text-4xl font-light text-white leading-tight">
            Innovation Hub <span className="font-semibold">Overview</span>
          </h1>
          <p className="text-white/30 text-sm mt-2">
            Vollständiger Systemüberblick — Bewerbungen, Departments und Nutzerverwaltung.
          </p>
        </motion.div>

        {/* ── Application Stats Strip ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-3"
        >
          <p className="text-[10px] tracking-[0.2em] font-semibold uppercase text-white/25 mb-3">Bewerbungen</p>
          <div className="grid grid-cols-5 gap-2 mb-8">
            {[
              { label: "Gesamt",       value: appStats.total,       color: "rgba(255,255,255,0.7)" },
              { label: "In Prüfung",   value: appStats.pending,     color: "#d97706" },
              { label: "Shortlisted",  value: appStats.shortlisted, color: "#8b5cf6" },
              { label: "Akzeptiert",   value: appStats.accepted,    color: "#16a34a" },
              { label: "Abgelehnt",    value: appStats.declined,    color: "#6b7280" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 rounded-sm text-center"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-2xl font-light mb-0.5" style={{ color }}>{value}</p>
                <p className="text-white/30 text-[10px] tracking-[0.1em] uppercase">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Quick Action Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-10"
        >
          {/* Applications */}
          <Link href="/applications">
            <div className="group p-5 rounded-sm cursor-pointer transition-[border-color,background-color] duration-200 hover:border-white/15"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-sm flex items-center justify-center"
                  style={{ background: "rgba(187,10,33,0.12)", border: "1px solid rgba(187,10,33,0.2)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h12M2 12h7" stroke={AUDI_RED} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-1 opacity-30 group-hover:opacity-60 transition-opacity">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold text-sm mb-1">Alle Bewerbungen</p>
              <p className="text-white/35 text-xs leading-relaxed">
                {appStats.total} Bewerbungen · {appStats.pending} ausstehend
              </p>
              <div className="mt-3 h-px w-full" style={{ background: `linear-gradient(90deg, ${AUDI_RED}44, transparent)` }} />
            </div>
          </Link>

          {/* Department Portal */}
          <Link href="/departments">
            <div className="group p-5 rounded-sm cursor-pointer transition-[border-color,background-color] duration-200 hover:border-white/15"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-sm flex items-center justify-center"
                  style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5L13.5 4.5v7L8 14.5 2.5 11.5v-7L8 1.5z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="8" cy="8" r="2" stroke="#3b82f6" strokeWidth="1.2"/>
                  </svg>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-1 opacity-30 group-hover:opacity-60 transition-opacity">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold text-sm mb-1">Department Portal</p>
              <p className="text-white/35 text-xs leading-relaxed">
                6 Departments · R&D, Design, Produktion …
              </p>
              <div className="mt-3 h-px w-full" style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.4), transparent)" }} />
            </div>
          </Link>

          {/* User Management anchor */}
          <a href="#user-management">
            <div className="group p-5 rounded-sm cursor-pointer transition-[border-color,background-color] duration-200 hover:border-white/15"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-sm flex items-center justify-center"
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="6" cy="5" r="2.5" stroke="#f59e0b" strokeWidth="1.5"/>
                    <path d="M1 13c0-2.2 2-4 5-4s5 1.8 5 4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M11.5 7.5l1.5 1.5 2.5-2.5" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-1 opacity-30 group-hover:opacity-60 transition-opacity">
                  <path d="M7 3v8M4 8l3 3 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold text-sm mb-1">User Management</p>
              <p className="text-white/35 text-xs leading-relaxed">
                {stats.total} Nutzer · {stats.staff} Staff · {stats.superuser} Superuser
              </p>
              <div className="mt-3 h-px w-full" style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.4), transparent)" }} />
            </div>
          </a>

          {/* Content Management anchor */}
          <a href="#content-management">
            <div className="group p-5 rounded-sm cursor-pointer transition-[border-color,background-color] duration-200 hover:border-white/15"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-sm flex items-center justify-center"
                  style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.22)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="5" height="5" rx="0.8" stroke="#8b5cf6" strokeWidth="1.4"/>
                    <rect x="9" y="2" width="5" height="5" rx="0.8" stroke="#8b5cf6" strokeWidth="1.4"/>
                    <rect x="2" y="9" width="5" height="5" rx="0.8" stroke="#8b5cf6" strokeWidth="1.4"/>
                    <path d="M11.5 9.5v4M9.5 11.5h4" stroke="#8b5cf6" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-1 opacity-30 group-hover:opacity-60 transition-opacity">
                  <path d="M7 3v8M4 8l3 3 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold text-sm mb-1">Content Management</p>
              <p className="text-white/35 text-xs leading-relaxed">
                Focus Areas · Chat-Fragen · System-Prompt
              </p>
              <div className="mt-3 h-px w-full" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.4), transparent)" }} />
            </div>
          </a>

          {/* Org Chart */}
          <Link href="/org">
            <div className="group p-5 rounded-sm cursor-pointer transition-[border-color,background-color] duration-200 hover:border-white/15"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-sm flex items-center justify-center"
                  style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.22)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="3.5" r="2" stroke="#14b8a6" strokeWidth="1.4"/>
                    <circle cx="3" cy="12" r="2" stroke="#14b8a6" strokeWidth="1.4"/>
                    <circle cx="13" cy="12" r="2" stroke="#14b8a6" strokeWidth="1.4"/>
                    <path d="M8 5.5v3M8 8.5L3 10.5M8 8.5l5 2" stroke="#14b8a6" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-1 opacity-30 group-hover:opacity-60 transition-opacity">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold text-sm mb-1">Org Chart</p>
              <p className="text-white/35 text-xs leading-relaxed">
                {stats.staff} Mitarbeiter · Bewerbungen zuweisen
              </p>
              <div className="mt-3 h-px w-full" style={{ background: "linear-gradient(90deg, rgba(20,184,166,0.4), transparent)" }} />
            </div>
          </Link>
        </motion.div>

        {/* User Management section anchor */}
        <div id="user-management" className="mb-6 pt-2">
          <p className="text-[10px] tracking-[0.2em] font-semibold uppercase text-white/25 mb-4">Nutzerverwaltung</p>
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
                className="px-3 py-2 text-xs font-semibold rounded-sm transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97]"
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

              const currentDept = pendingDept[user.id] !== undefined ? pendingDept[user.id] : user.departmentId;
              const isDeptDirty = pendingDept[user.id] !== undefined && pendingDept[user.id] !== user.departmentId;
              const isDeptSaving = deptMutation.isPending && deptMutation.variables?.userId === user.id;

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

                  {/* Role + dept selectors */}
                  <div className="col-span-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <select
                        value={currentRole ?? ""}
                        onChange={e => setPendingRole(p => ({ ...p, [user.id]: e.target.value || null }))}
                        disabled={isSaving}
                        className="flex-1 px-3 py-1.5 rounded-sm text-xs text-white outline-none transition-[border-color] duration-200"
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
                          className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] whitespace-nowrap"
                          style={{ background: AUDI_RED, color: "#fff" }}
                        >
                          {isSaving ? "…" : "Save"}
                        </button>
                      )}

                      {saved[user.id] && !isDirty && (
                        <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>✓ Saved</span>
                      )}
                    </div>

                    {/* Department selector — only for audi_staff */}
                    {currentRole === "audi_staff" && (
                      <div className="flex items-center gap-2">
                        <select
                          value={currentDept ?? ""}
                          onChange={e => setPendingDept(p => ({ ...p, [user.id]: e.target.value || null }))}
                          disabled={isDeptSaving}
                          className="flex-1 px-3 py-1.5 rounded-sm text-xs text-white outline-none transition-[border-color] duration-200"
                          style={{
                            background: "rgba(59,130,246,0.06)",
                            border: `1px solid ${isDeptDirty ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.2)"}`,
                          }}
                        >
                          <option value="">— Abteilung —</option>
                          {DEPARTMENTS.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>

                        {isDeptDirty && (
                          <button
                            onClick={() => deptMutation.mutate({ userId: user.id, departmentId: currentDept ?? null })}
                            disabled={isDeptSaving}
                            className="px-3 py-1.5 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] whitespace-nowrap"
                            style={{ background: "#3b82f6", color: "#fff" }}
                          >
                            {isDeptSaving ? "…" : "Save"}
                          </button>
                        )}

                        {savedDept[user.id] && !isDeptDirty && (
                          <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>✓</span>
                        )}
                      </div>
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

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* Content Management                                                    */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div id="content-management" className="mt-16 pt-2">
          <p className="text-[10px] tracking-[0.2em] font-semibold uppercase text-white/25 mb-1">Inhalte verwalten</p>
          <p className="text-white/30 text-xs mb-8">
            Änderungen sind live sobald gespeichert — kein Redeploy nötig.
          </p>
        </div>

        {/* ── Focus Areas Editor ── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Focus Areas</p>
              <p className="text-white/30 text-xs mt-0.5">Erscheinen auf der Homepage unter „Fields of Interest"</p>
            </div>
            <div className="flex items-center gap-3">
              {focusSavedOk && <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>✓ Gespeichert</span>}
              <button
                onClick={saveFocusAreas}
                disabled={savingFocus}
                className="px-4 py-2 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
                style={{ background: AUDI_RED, color: "#fff", opacity: savingFocus ? 0.6 : 1 }}
              >
                {savingFocus ? "Speichern…" : "Focus Areas speichern"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {focusAreas.map((area, idx) => (
              <div key={idx} className="rounded-sm" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)" }}>
                {editingIdx === idx ? (
                  /* ── Inline edit form ── */
                  <div className="p-4 flex flex-col gap-3">
                    <input
                      value={editDraft.title}
                      onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                      placeholder="Titel"
                      className="w-full px-3 py-2 rounded-sm text-sm text-white placeholder-white/25 outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                    <input
                      value={editDraft.topics}
                      onChange={e => setEditDraft(d => ({ ...d, topics: e.target.value }))}
                      placeholder="Topics (kommagetrennt)"
                      className="w-full px-3 py-2 rounded-sm text-sm text-white placeholder-white/25 outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editDraft.isWildcard}
                        onChange={e => setEditDraft(d => ({ ...d, isWildcard: e.target.checked }))}
                        className="accent-[#BB0A21]"
                      />
                      <span className="text-xs text-white/50">Open Category / Wildcard-Karte</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updated = focusAreas.map((a, i) =>
                            i === idx
                              ? { title: editDraft.title, topics: editDraft.topics.split(",").map(t => t.trim()).filter(Boolean), isWildcard: editDraft.isWildcard || undefined }
                              : a
                          );
                          setFocusAreas(updated);
                          setEditingIdx(null);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-sm text-white"
                        style={{ background: AUDI_RED }}
                      >
                        ✓ Übernehmen
                      </button>
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="px-3 py-1.5 text-xs rounded-sm text-white/40 hover:text-white/70 transition-colors"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Read-only row ── */
                  <div className="px-4 py-3 flex items-start gap-3">
                    <span className="text-white/20 text-xs font-mono mt-0.5 shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{area.title}</p>
                      <p className="text-white/30 text-xs mt-0.5 truncate">{area.topics.slice(0, 5).join(", ")}{area.topics.length > 5 ? ` +${area.topics.length - 5}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditDraft({ title: area.title, topics: area.topics.join(", "), isWildcard: !!area.isWildcard });
                          setEditingIdx(idx);
                        }}
                        className="px-2.5 py-1.5 text-xs rounded-sm text-white/40 hover:text-white/80 transition-colors"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setFocusAreas(areas => areas.filter((_, i) => i !== idx))}
                        className="px-2.5 py-1.5 text-xs rounded-sm text-white/25 hover:text-red-400 transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1 3h10M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M2.5 3l.6 7a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5l.6-7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setFocusAreas(a => [...a, { title: "", topics: [] }]);
              setEditDraft({ title: "", topics: "", isWildcard: false });
              setEditingIdx(focusAreas.length);
            }}
            className="mt-3 w-full py-2.5 text-xs font-semibold rounded-sm transition-[border-color,color] duration-150 hover:border-white/20 hover:text-white/70"
            style={{ border: "1px dashed rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)", background: "transparent" }}
          >
            + Bereich hinzufügen
          </button>
        </div>

        {/* ── Chat Config Editor ── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Chat-Konfiguration</p>
              <p className="text-white/30 text-xs mt-0.5">System-Prompt und Fragen des Bewerbungs-Chatbots</p>
            </div>
            <div className="flex items-center gap-3">
              {chatSavedOk && <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>✓ Gespeichert</span>}
              <button
                onClick={saveChatConfig}
                disabled={savingChat}
                className="px-4 py-2 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
                style={{ background: AUDI_RED, color: "#fff", opacity: savingChat ? 0.6 : 1 }}
              >
                {savingChat ? "Speichern…" : "Chat-Config speichern"}
              </button>
            </div>
          </div>

          {/* System prompt intro */}
          <div className="mb-6">
            <label className="block text-xs text-white/40 font-medium mb-2 tracking-wide uppercase">
              System-Prompt Intro
            </label>
            <textarea
              value={chatIntro}
              onChange={e => setChatIntro(e.target.value)}
              rows={3}
              placeholder="You are the official AI assistant for the Audi Innovation Hub…"
              className="w-full px-3 py-2.5 rounded-sm text-sm text-white placeholder-white/20 outline-none resize-none leading-relaxed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
            />
            <p className="text-white/20 text-[10px] mt-1.5">
              Der erste Satz des System-Prompts — definiert Rolle und Kontext des Chatbots.
            </p>
          </div>

          {/* Per-field questions */}
          <div className="flex flex-col gap-3">
            {Object.entries(CHAT_FIELD_LABELS).map(([field, label]) => (
              <div key={field} className="grid grid-cols-12 gap-3 items-center">
                <label className="col-span-3 text-xs text-white/40 font-medium tracking-wide">
                  {label}
                </label>
                <input
                  value={chatQuestions[field] ?? ""}
                  onChange={e => setChatQuestions(q => ({ ...q, [field]: e.target.value }))}
                  className="col-span-9 px-3 py-2 rounded-sm text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
                  placeholder={`Frage für "${label}"…`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Analyse-Prompt Editor ── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Analyse-Prompt (KI-Bewertung)</p>
              <p className="text-white/30 text-xs mt-0.5">Der Prompt den die KI erhält, um Bewerbungen zu bewerten und Business Cases zu generieren</p>
            </div>
            <div className="flex items-center gap-2">
              {promptSavedOk && <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>✓ Gespeichert</span>}
              <button
                onClick={resetAnalysisPrompt}
                disabled={resettingPrompt}
                className="px-3 py-2 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", opacity: resettingPrompt ? 0.6 : 1 }}
              >
                {resettingPrompt ? "Zurücksetzen…" : "Auf Standard zurücksetzen"}
              </button>
              <button
                onClick={saveAnalysisPrompt}
                disabled={savingPrompt}
                className="px-4 py-2 text-xs font-semibold rounded-sm transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
                style={{ background: AUDI_RED, color: "#fff", opacity: savingPrompt ? 0.6 : 1 }}
              >
                {savingPrompt ? "Speichern…" : "Prompt speichern"}
              </button>
            </div>
          </div>

          {/* Placeholder hint */}
          <div className="mb-4 px-4 py-3 rounded-sm flex flex-wrap gap-x-5 gap-y-2"
            style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <p className="text-xs w-full font-semibold" style={{ color: "#60a5fa" }}>Verfügbare Platzhalter — werden zur Laufzeit ersetzt:</p>
            {[
              { ph: "{{companyName}}", desc: "Name des Startups" },
              { ph: "{{transcriptText}}", desc: "Vollständiges Interview-Transkript" },
              { ph: "{{departmentsList}}", desc: "JSON-Array aller 6 Audi-Abteilungen" },
            ].map(({ ph, desc }) => (
              <span key={ph} className="flex items-center gap-1.5 text-xs">
                <code className="px-1.5 py-0.5 rounded font-mono text-[11px]"
                  style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd" }}>{ph}</code>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</span>
              </span>
            ))}
          </div>

          <textarea
            value={analysisPrompt}
            onChange={e => setAnalysisPrompt(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full px-4 py-3 rounded-sm text-sm text-white placeholder-white/20 outline-none resize-y leading-relaxed"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.09)",
              fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace",
              fontSize: "12px",
              lineHeight: "1.7",
            }}
          />
          <p className="text-white/20 text-[10px] mt-1.5">
            Änderungen sind innerhalb von 60 Sekunden aktiv (Cache-TTL). Nächste Analyse nach dem Speichern nutzt den neuen Prompt.
          </p>
        </div>

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
