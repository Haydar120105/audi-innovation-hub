# Audi Innovation Hub — Handoff-Dokument für Claude

## Was ist dieses Projekt?

Eine KI-gestützte Bewerbungsplattform für Startups, die mit Audi AG zusammenarbeiten möchten. Statt einem starren Formular führt ein freier Konversations-Chatbot (Claude) das Startup durch die Bewerbung. Claude extrahiert die relevanten Felder automatisch per Tool Use, optional via PDF-Upload (Pitch Deck). Am Ende analysiert Claude die Bewerbung, bewertet die 6 Audi-Abteilungen (0–100 Punkte) und schreibt Business-Case-Briefings. Audi-Abteilungsvertreter können Bewerbungen in einem eigenen Portal einsehen und verwalten.

---

## Architektur — pnpm Monorepo

```
artifacts/
├── api-server/           # Express 5 Backend (Port 8000)
└── audi-innovation-hub/  # React/Vite Frontend (Port 5173)
lib/
├── db/                   # PostgreSQL + Drizzle ORM Schema
├── api-spec/             # OpenAPI YAML + Orval Codegen-Config
├── api-client-react/     # Generierte React-Query-Hooks (via Orval)
├── api-zod/              # Generierte Zod-Schemas (via Orval)
└── integrations-anthropic-ai/  # Anthropic SDK Client-Wrapper
scripts/                  # Hilfsskripte
```

`artifacts/mockup-sandbox/` ist ein Replit-Sandbox-Artifact — kein produktiver Code.

---

## Lokales Starten

```bash
# 1. Secrets anlegen (einmalig)
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Dann DATABASE_URL, ANTHROPIC_API_KEY, DEPARTMENT_WRITE_SECRET eintragen

# 2. Dependencies
pnpm install

# 3. DB-Schema pushen (nur einmalig / nach Schema-Änderungen)
pnpm --filter @workspace/db run push

# 4. API Server (Port 8000) — aus eigenem Terminal
pnpm --filter @workspace/api-server run dev

# 5. Frontend (Port 5173) — aus eigenem Terminal
pnpm --filter @workspace/audi-innovation-hub run dev
```

Frontend läuft auf **http://localhost:5173**, Vite proxyt `/api/*` → `http://localhost:8000`.

### Weitere Befehle

```bash
pnpm run typecheck                             # Typecheck über alle Packages
pnpm run build                                 # Typecheck + Build alle Packages
pnpm --filter @workspace/api-spec run codegen  # API-Hooks + Zod-Schemas neu generieren
pnpm --filter @workspace/db run push           # DB-Schema pushen
```

---

## Umgebungsvariablen

### Backend (artifacts/api-server/.env)
```env
PORT=8000
NODE_ENV=development
DATABASE_URL=postgresql://...      # Neon oder beliebige Postgres-Instanz
ANTHROPIC_API_KEY=sk-ant-...       # Claude API Key (Pflicht)
DEPARTMENT_WRITE_SECRET=...        # Legacy Bearer Token (nicht mehr primär genutzt)
CLERK_PUBLISHABLE_KEY=pk_test_...  # Clerk — aus dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_...       # Clerk — aus dashboard.clerk.com
```

### Frontend (artifacts/audi-innovation-hub/.env.local)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  # Gleicher Key wie im Backend
```

**Sicherheit:** Alle `.env`-Dateien sind in `.gitignore`. Templates unter `*.env.example`. API-Keys regelmäßig rotieren.

**Dev ohne Clerk-Keys:** Wenn `CLERK_*`-Keys fehlen oder `REPLACE_ME` enthalten, loggt das Backend eine Warnung und deaktiviert Auth transparent. Alle Routen sind dann offen — nur für lokale Entwicklung!

Das dev-Script lädt `.env` explizit per Shell-Source:
```
set -a && . ./.env && set +a && export NODE_ENV=development && node ./build.mjs && ...
```

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Monorepo | pnpm workspaces, Node.js 24, TypeScript 5.9 |
| Backend | Express 5, Pino (Logging), CORS, multer (File Upload) |
| Datenbank | PostgreSQL (Neon) + Drizzle ORM + drizzle-zod |
| Validierung | Zod v4 |
| API-Codegen | Orval (OpenAPI → React-Query-Hooks + Zod-Schemas) |
| Frontend | React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query v5 |
| Animationen | Framer Motion |
| KI | Anthropic SDK (`claude-sonnet-4-6`) |
| Build | esbuild (Bundle für Backend) |

---

## macOS-spezifisch (Fallstricke bei lokalem Dev)

`pnpm-workspace.yaml` enthielt ursprünglich Overrides für Replit (Linux x64 only):
```yaml
# Diese darwin-Einträge sind auskommentiert — nötig für macOS-Entwicklung:
# rollup → @rollup/rollup-darwin-arm64
# lightningcss → lightningcss-darwin-arm64
# @tailwindcss/oxide → @tailwindcss/oxide-darwin-arm64
```
Falls nach `pnpm install` Binary-Fehler auftauchen: prüfen ob die darwin-Overrides versehentlich wieder aktiv sind.

Port 5000 ist auf macOS oft belegt (AirPlay Receiver). API-Server läuft deshalb auf **8000**.

---

## Datenbank-Schema (lib/db/src/schema/)

### applications (Haupttabelle)
```sql
id               UUID PK (random)
createdAt        TIMESTAMP WITH TZ
status           ENUM('pending','routed','shortlisted','accepted','declined','archived')
companyName      TEXT NOT NULL
website          TEXT
stage            TEXT
teamSize         TEXT
transcript       JSONB NOT NULL DEFAULT []    ← Chat-Verlauf
structuredData   JSONB                        ← KI-extrahierte Felder
departmentScores JSONB                        ← [{departmentId, departmentName, score, justification}]
businessCases    JSONB                        ← Top-2-Abteilungen mit ~200-Wort-Brief
trackingToken    TEXT UNIQUE                  ← Für öffentlichen Tracking-Link (kein Login)
notes            TEXT                         ← Abteilungsnotizen
```

`conversations` + `messages` existieren im Schema, werden aber aktuell nicht genutzt (Legacy).

---

## API Endpoints (artifacts/api-server/src/routes/)

Alle Endpoints unter `/api`:

| Method | Pfad | Datei | Beschreibung |
|--------|------|-------|-------------|
| GET | `/healthz` | health.ts | Health Check |
| POST | `/applications` | applications/index.ts | Bewerbung einreichen → KI-Analyse synchron |
| GET | `/applications` | applications/index.ts | Alle Bewerbungen |
| GET | `/applications/:id` | applications/index.ts | Einzelne Bewerbung |
| PATCH | `/applications/:id` | applications/index.ts | Status/Notizen (Bearer-Token) |
| GET | `/applications/track/:token` | applications/index.ts | Öffentlicher Tracker |
| POST | `/chat` | chat.ts | Chatbot-Konversation mit Claude Tool Use |
| POST | `/extract-pdf` | extract-pdf.ts | PDF-Pitch-Deck → Felder extrahieren |

**PATCH-Auth:** `Authorization: Bearer <DEPARTMENT_WRITE_SECRET>` — 401 bei falschem Token.

---

## Chatbot-Endpoint (artifacts/api-server/src/routes/chat.ts)

```
POST /api/chat
Body: { messages: [{role, content}][], collectedFields: Record<string, unknown> }
Response: { reply: string, extractedFields: Record<string, unknown> }
```

- Baut dynamischen System-Prompt basierend auf `collectedFields` (bereits gesammelt vs. noch fehlend)
- Nutzt Claude mit `save_startup_info` Tool — extrahiert Felder automatisch während der Konversation
- 7 Pflichtfelder: `companyName`, `problem`, `solution`, `technology`, `stage`, `teamSize`, `targetDepartments`
- Optionale Felder: `website`, `pitchDeckUrl`, `additionalContext`
- Wenn Claude nur das Tool aufruft (kein Text), wird ein Follow-Up-Call gemacht um eine Antwort zu bekommen
- Bot antwortet auf Deutsch oder Englisch je nach Nutzersprache

**Die 6 Audi-Abteilungen (für targetDepartments):**
```
production  → Production & Manufacturing
rd          → Research & Development
design      → Design Studio
logistics   → Logistics & Supply Chain
sales       → Sales & Customer Experience
digital     → Digital & IT
```

---

## PDF-Extraktion (artifacts/api-server/src/routes/extract-pdf.ts)

```
POST /api/extract-pdf
Body: multipart/form-data, Feld "file" (PDF, max 20MB)
Response: { extracted: Record<string,unknown>, found: string[], missing: string[] }
```

- multer mit memoryStorage (kein Disk-Write)
- PDF wird als base64 an Claude übergeben (`{ type: "document", source: { type: "base64", media_type: "application/pdf", data: ... } }`)
- Claude extrahiert alle Startup-Felder als JSON aus dem Dokument
- `found` = Felder die gefunden wurden, `missing` = Pflichtfelder die noch fehlen

---

## KI-Analyse bei Bewerbungseinreichung (artifacts/api-server/src/routes/applications/analyze.ts)

- **Trigger:** Jede `POST /applications` → sofortige synchrone Analyse
- **Modell:** `claude-sonnet-4-6`, max 8192 Tokens
- **Input:** Kompletter Chat-Transcript
- **Output:** `structuredData` + `departmentScores` (6 Abteilungen, 0–100) + `businessCases` (Top-2)
- **Fallback:** Bei KI-Fehler wird Bewerbung trotzdem mit Status `pending` gespeichert

---

## Frontend — Seiten (artifacts/audi-innovation-hub/src/pages/)

| Route | Datei | Beschreibung |
|-------|-------|-------------|
| `/` | Home.tsx | Landingpage: PlantScene → FocusAreas → Benefits |
| `/apply` | Apply.tsx | Konversations-Chatbot (freier Chat + PDF-Upload) |
| `/applications` | Applications.tsx | Liste aller Bewerbungen |
| `/applications/:id` | Applications.tsx | Detailansicht: Scores + Business Cases |
| `/departments` | DepartmentPortal.tsx | Abteilungsauswahl (Key-gated) |
| `/departments/:id` | DepartmentPortal.tsx | Bewerbungen einer Abteilung + Aktionen |
| `/track/:token` | Track.tsx | Öffentlicher Status-Tracker (kein Login) |

---

## Bewerbungs-Chatbot (Apply.tsx) — aktueller Stand

**Freier Konversations-Chat** statt starrem 8-Schritt-Formular:

- **State:** `messages`, `collectedFields`, `isLoading`, `isPdfLoading`, `isSubmitting`
- **Header:** Audi-Logo links + `FieldProgress` rechts ("X / 7 Felder" → grün "Ready to submit")
- **Felder-Tracking:** Frontend merged `extractedFields` aus jeder Chat-Response in `collectedFields`
- **PDF-Upload:** Paperclip-Button → `POST /api/extract-pdf` → Bot bestätigt was gefunden/fehlt
- **Submit-Button:** Erscheint inline im Chat sobald alle 7 Pflichtfelder gefüllt sind
- **Einreichen:** `POST /api/applications` mit Transcript + `collectedFields` (companyName, website, stage, teamSize)
- **Nach Submit:** `SuccessScreen` mit Tracking-Link + Top-3-Abteilungs-Matches

---

## Department Portal (DepartmentPortal.tsx)

- **Key-Gate:** `DEPARTMENT_WRITE_SECRET` → `localStorage` unter `dept_portal_key`
- **Score-Schwellenwert:** ≥ 50 Punkte für Anzeige in Abteilungsansicht
- **Aktionen:** Shortlist, Accept, Decline, Notes (alle via `PATCH /api/applications/:id`)
- **401-Handling:** Falscher Key → automatisch ausloggen

---

## Assets

- `artifacts/audi-innovation-hub/public/audi-logo.png` — Audi Vieringe-Logo mit transparentem Hintergrund (weißer BG per Pillow entfernt)
- Wird in PlantScene.tsx (Home, oben links) und Apply.tsx (Header) eingebunden

---

## API-Codegen-Flow

```
lib/api-spec/openapi.yaml
        │
        │  pnpm --filter @workspace/api-spec run codegen
        ▼
lib/api-client-react/src/generated/   ← React-Query-Hooks
lib/api-zod/src/generated/            ← Zod-Schemas + TypeScript-Typen
```

Generierte Dateien NIE manuell editieren. Nach jeder `openapi.yaml`-Änderung Codegen neu ausführen.

---

## Workspace-Packages

| Package | pnpm-Name |
|---------|-----------|
| api-server | `@workspace/api-server` |
| audi-innovation-hub | `@workspace/audi-innovation-hub` |
| db | `@workspace/db` |
| api-spec | `@workspace/api-spec` |
| api-client-react | `@workspace/api-client-react` |
| api-zod | `@workspace/api-zod` |
| integrations-anthropic-ai | `@workspace/integrations-anthropic-ai` |

Shared Dependency-Versionen im `catalog:` Block in `pnpm-workspace.yaml`.

---

## Bekannte Eigenheiten & Fallstricke

- **Nur pnpm:** `preinstall`-Hook blockiert npm/yarn.
- **Supply-Chain-Schutz:** `.npmrc` hat `minimumReleaseAge: 1440` — neue Pakete brauchen 1 Tag.
- **esbuild-Override:** `esbuild: "0.27.3"` als Override wegen Drizzle-Kit-Vulnerability — nicht ändern.
- **JSONB-Typen:** `departmentScores`, `businessCases`, `transcript` sind JSONB — immer casten.
- **KI synchron:** Claude-Analyse läuft synchron beim POST (~20–30s). Frontend zeigt Spinner.
- **Track-Token öffentlich:** UUID, kein Auth. Gibt nur companyName, status, createdAt, departmentScores zurück — kein Transcript.
- **AnimatePresence:** Muss `mode="wait"` haben in PlantScene.tsx, sonst überlappen Karten-Animationen.
- **Vite Proxy:** Nur aktiv wenn `REPL_ID` nicht gesetzt ist (kein Replit). Proxyt `/api` → `localhost:8000`.
- **Replit-Plugins:** `runtimeErrorOverlay()` und `cartographer()` sind in vite.config.ts hinter `process.env.REPL_ID !== undefined` gegateed.

---

## Authentifizierung (Clerk)

### Routen-Schutz (Frontend — App.tsx)
| Route | Zugang |
|-------|--------|
| `/` | Öffentlich |
| `/sign-in` | Öffentlich |
| `/track/:token` | Öffentlich |
| `/apply` | Clerk sign-in erforderlich |
| `/applications/:id` | Clerk sign-in + eigene Bewerbung ODER audi_staff |
| `/applications` | Nur `audi_staff` |
| `/departments`, `/departments/:id` | Nur `audi_staff` |

### API-Schutz (Backend — auth.ts)
| Endpoint | Middleware |
|----------|-----------|
| `POST /chat` | `requireAuth` |
| `POST /extract-pdf` | `requireAuth` |
| `POST /applications` | `requireAuth` |
| `GET /applications` | `requireAuth` (audi_staff sieht alle, andere nur eigene) |
| `GET /applications/:id` | `requireAuth` (owner oder audi_staff) |
| `PATCH /applications/:id` | `requireAudiStaff` |
| `GET /applications/track/:token` | Öffentlich |

### Audi-Staff-Rolle vergeben
Im [Clerk Dashboard](https://dashboard.clerk.com) → Users → Nutzer auswählen → **Edit public metadata**:
```json
{ "role": "audi_staff" }
```

### Components
- `src/lib/auth.ts` — `requireAuth`, `requireAudiStaff`, `getUserId`, `isAudiStaff`
- `src/pages/SignIn.tsx` — Clerk `<SignIn>` mit Audi-Styling
- `App.tsx` → `<Protected>` (sign-in required) und `<AudiStaffOnly>` (role required)
- `Apply.tsx` → `UserButton` im Header, `getToken()` für API-Calls

### Clerk-Keys einrichten
1. Konto erstellen: [dashboard.clerk.com](https://dashboard.clerk.com)
2. Neue Application anlegen
3. Keys kopieren in:
   - `artifacts/api-server/.env` → `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
   - `artifacts/audi-innovation-hub/.env.local` → `VITE_CLERK_PUBLISHABLE_KEY`

---

## TODOs / Noch nicht implementiert

- Pagination für `/applications` (alle auf einmal geladen)
- E-Mail-Benachrichtigung bei Statusänderung
- Echte Auth für Admin-Ansicht (aktuell nur Department-Write-Secret)
- `mockup-sandbox` ist nur Replit-Prototyp — kein produktiver Code
