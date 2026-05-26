# Audi Innovation Hub — Root CLAUDE.md

> KI-Bewerbungsplattform für Startups. Konversations-Chatbot (Claude) führt durch die Bewerbung, analysiert automatisch gegen 6 Audi-Abteilungen, Audi-Staff bewertet im Dashboard.

---

## Monorepo-Karte

```
pnpm-workspace.yaml  ← verknüpft alle Pakete
│
├── artifacts/
│   ├── api-server/           → Express 5, Port 8000   (BACKEND — kein Hot-Reload)
│   └── audi-innovation-hub/  → React/Vite, Port 5173  (FRONTEND)
│
├── lib/
│   ├── db/                   → Drizzle ORM Schema + PostgreSQL-Client
│   ├── api-spec/             → openapi.yaml + Orval-Codegen-Config
│   ├── api-zod/              → Zod-Schemas (Orval-generiert + manuell erweitert!)
│   ├── api-client-react/     → React-Query-Hooks (Orval-generiert + manuell erweitert!)
│   └── integrations-anthropic-ai/ → Anthropic SDK Client-Wrapper
│
└── scripts/                  → Hilfsskripte (post-merge.sh)
```

**Workspace-Name:** `@workspace/<paketname>` — z.B. `@workspace/db`, `@workspace/api-server`.

---

## Start

```bash
# Einmalig
pnpm install
pnpm --filter @workspace/db run push          # Schema → Neon-Postgres pushen

# Terminal 1 — Backend (kein Hot-Reload!)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
pnpm --filter @workspace/audi-innovation-hub run dev
```

URLs: Frontend → **http://localhost:5173** | Backend → **http://localhost:8000**
Vite proxyt `/api/*` → `localhost:8000` (nur lokal, nicht auf Replit).

---

## Haupt-Datenfluss

```
Browser (React)
  │
  │  1. POST /api/chat  → Chatbot-Konversation (2-Call-Muster: Extraktion + Reply)
  │  2. POST /api/extract-pdf  → Pitch-Deck hochladen
  │  3. POST /api/applications  → Bewerbung einreichen + KI-Analyse (~20s)
  │
  ▼
Express API Server (Port 8000)
  │
  ├── Clerk Auth-Middleware  ← validiert JWT aus Browser
  ├── Zod-Validierung        ← parsed Request Body
  │
  ├── lib/db  →  PostgreSQL (Neon)
  │     └── applicationsTable  ← alles landet hier
  │
  └── Anthropic SDK  →  claude-sonnet-4-6
        ├── /chat        → Zwei-Call: 1. Tool-Extraktion (forced), 2. Konversations-Antwort
        ├── /extract-pdf → PDF als base64 → Felder aus Pitch Deck
        └── /applications → analyze.ts: Scores (0–100) für 6 Abteilungen + Business Cases
```

---

## Rollen & Zugang

| Rolle | Gesetzt in | Zugang |
|-------|-----------|--------|
| `superuser` | Clerk `publicMetadata.role` | Alles: `/admin` + `/applications` + alle Seiten; kann Staff zuweisen |
| `audi_staff` | Clerk `publicMetadata.role` | `/applications` — **nur zugewiesene** Bewerbungen sichtbar |
| _(kein role)_ | — | Nur eigene Bewerbung: `/apply`, `/dashboard`, `/track/:token` |

**Erste Superuser-Einrichtung:**
1. [dashboard.clerk.com](https://dashboard.clerk.com) → User → Edit public metadata → `{ "role": "superuser" }`
2. Danach alle Rollen über `/admin` verwalten (ohne Clerk-Dashboard)

### ⚠️ Kritisch: Wie Rollen gelesen werden

**Frontend:** `useUser()` für Metadaten, `useAuth()` für Token/Claims:
```tsx
// Rollenprüfung → useUser()
const { user } = useUser();
const role = user?.publicMetadata?.["role"] as string | undefined;

// ODER sessionClaims aus useAuth() — funktioniert auch in Home.tsx:
const { sessionClaims } = useAuth();
const meta = sessionClaims?.["publicMetadata"] as Record<string, unknown> | undefined;
const role = meta?.["role"] as string | undefined;
```
`sessionClaims?.["publicMetadata"]` enthält die Rolle nur wenn das Clerk JWT-Template `publicMetadata` einschließt.

**Backend:** Immer Clerk API direkt aufrufen, NICHT JWT-Claims lesen:
```typescript
const { createClerkClient } = await import("@clerk/express");
const clerkUser = await createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] }).users.getUser(userId);
const role = clerkUser.publicMetadata?.["role"] as string | undefined;
```
`createClerkClient` ist eine **Funktion** die eine Instanz zurückgibt — immer mit `{ secretKey }` aufrufen.

**Rollenänderung wirkt sofort** (kein Re-Login nötig, da wir direkt Clerk API lesen, nicht JWT-Cache).

---

## Env-Variablen

### Backend (`artifacts/api-server/.env`)
```env
PORT=8000
DATABASE_URL=postgresql://...        # Neon-Postgres
ANTHROPIC_API_KEY=sk-ant-...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...         # NUR Backend, nie ins Frontend!
```

### Frontend (`artifacts/audi-innovation-hub/.env.local`)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # Nur Publishable Key
```

**Dev ohne Clerk:** Wenn Keys fehlen/`REPLACE_ME`, deaktiviert Backend Auth transparent (`CLERK_ENABLED = false`). Alle Routen offen.

---

## Produktion (Docker auf Strato VPS)

Server läuft unter **http://85.215.132.195** (HTTP-only, noch keine Domain/SSL).

```bash
# Lokale Entwicklung → committen → pushen
git push origin main

# Auf Server deployen (SSH: root@85.215.132.195)
cd ~/audi-innovation-hub
git pull
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

Vollständige Doku: siehe **DEPLOYMENT.md**

---

## Codegen-Warnung ⚠️

`lib/api-client-react` und `lib/api-zod` wurden **nach dem letzten Codegen-Lauf manuell erweitert** (Staff-Assessment-Felder: `rating`, `nextStep`, `requirements`, `milestones`, `kpis`, `assignedEmployee`, `ndaStatus`). Ein neuer Codegen-Lauf überschreibt diese!

```bash
# Codegen (nur wenn openapi.yaml geändert)
pnpm --filter @workspace/api-spec run codegen
# Danach: manuelle Erweiterungen in api-zod + api-client-react erneut eintragen

# Typen neu bauen (nach Typ-Änderungen ohne Codegen)
cd lib/api-client-react && npx tsc --build
```

---

## Kritische Eigenheiten

- **Nur pnpm** — `preinstall`-Hook blockiert npm/yarn
- **API-Server kein Hot-Reload** — nach Backend-Änderungen neu starten
- **esbuild Override `0.27.3`** — wegen Drizzle-Kit, nicht ändern
- **Port 5000** belegt auf macOS (AirPlay) → API auf Port 8000
- **JSONB-Felder** (`departmentScores`, `requirements`, `assignedEmployee` etc.) immer casten
- **`createClerkClient`** aus `@clerk/express` ist eine **Fabrik-Funktion** — immer `createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] })` aufrufen und dann `.users.getUser(id)` etc.
- **Wouter `routing="hash"`** in SignIn/SignUp — Clerk navigiert intern zu Sub-Paths
- **Audi Staff sieht nur eigene**: `assignedEmployee.clerkId` muss mit der Clerk-ID des Staff-Users übereinstimmen

---

## Wo was ändern

| Aufgabe | Datei |
|---------|-------|
| Neuer API-Endpoint | `artifacts/api-server/src/routes/` |
| Datenbankfeld hinzufügen | `lib/db/src/schema/applications.ts` + `pnpm --filter @workspace/db run push` |
| Neue Frontend-Seite | `artifacts/audi-innovation-hub/src/pages/` + Route in `App.tsx` |
| UI-Komponente | `artifacts/audi-innovation-hub/src/components/` |
| API-Typ ändern | `lib/api-spec/openapi.yaml` + Codegen (oder manuell in api-zod + api-client-react) |
| KI-Prompt (Chatbot) | `artifacts/api-server/src/routes/chat.ts` → `buildReplyPrompt()` + `SAVE_TOOL` |
| KI-Prompt (Analyse) | `artifacts/api-server/src/routes/applications/analyze.ts` |
| Auth-Logik | `artifacts/api-server/src/lib/auth.ts` |
| Rollen-Management UI | `artifacts/audi-innovation-hub/src/pages/Admin.tsx` |
| Staff zuweisen + Pipeline | `artifacts/audi-innovation-hub/src/pages/Applications.tsx` → `StaffPanel` |
