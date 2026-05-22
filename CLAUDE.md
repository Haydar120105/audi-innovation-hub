# Audi Innovation Hub — Handoff-Dokument für Claude

## Was ist dieses Projekt?

Eine KI-gestützte Bewerbungsplattform für Startups, die mit Audi AG zusammenarbeiten möchten. Ein freier Konversations-Chatbot (Claude) führt das Startup durch die Bewerbung — kein starres Formular. Claude extrahiert Felder automatisch per Tool Use, optional via PDF-Upload (Pitch Deck). Nach Einreichen analysiert Claude die Bewerbung, bewertet 6 Audi-Abteilungen (0–100 Punkte) und schreibt Business-Case-Briefings. Audi-Staff kann alle Bewerbungen im Dashboard einsehen, bewerten, next steps definieren und Requirements/Milestones/KPIs setzen. Superuser verwalten alle Nutzerrollen über ein eigenes Admin-Dashboard.

---

## Architektur — pnpm Monorepo

```
artifacts/
├── api-server/           # Express 5 Backend (Port 8000)
└── audi-innovation-hub/  # React/Vite Frontend (Port 5173)
lib/
├── db/                   # PostgreSQL + Drizzle ORM Schema
├── api-spec/             # OpenAPI YAML + Orval Codegen-Config
├── api-client-react/     # Generierte React-Query-Hooks (via Orval) — MANUELL ERWEITERT
├── api-zod/              # Generierte Zod-Schemas (via Orval) — MANUELL ERWEITERT
└── integrations-anthropic-ai/  # Anthropic SDK Client-Wrapper
scripts/                  # Hilfsskripte
```

**Wichtig:** `lib/api-client-react` und `lib/api-zod` enthalten generierte Dateien, die nach der letzten Session **manuell erweitert** wurden (neue Felder für Staff-Aktionen). Bei einem erneuten Codegen-Lauf würden diese Ergänzungen überschrieben. Entweder den Codegen-Flow anpassen oder manuelle Änderungen danach erneut eintragen.

`artifacts/mockup-sandbox/` ist ein Replit-Sandbox-Artifact — kein produktiver Code.

---

## Lokales Starten

```bash
# 1. Secrets anlegen (einmalig)
cp artifacts/api-server/.env.example artifacts/api-server/.env
# DATABASE_URL, ANTHROPIC_API_KEY, CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY eintragen

# 2. Dependencies
pnpm install

# 3. DB-Schema pushen (einmalig / nach Schema-Änderungen)
pnpm --filter @workspace/db run push

# 4. API Server (Port 8000) — aus eigenem Terminal
pnpm --filter @workspace/api-server run dev

# 5. Frontend (Port 5173) — aus eigenem Terminal
pnpm --filter @workspace/audi-innovation-hub run dev
```

Frontend läuft auf **http://localhost:5173**, Vite proxyt `/api/*` → `http://localhost:8000`.

**Wichtig:** Der API-Server hat KEINEN Hot-Reload. Nach Code-Änderungen am Backend muss er neu gestartet werden (`Ctrl+C` → `pnpm --filter @workspace/api-server run dev`). Das Build-Script läuft per esbuild:
```
set -a && . ./.env && set +a && export NODE_ENV=development && node ./build.mjs && node --enable-source-maps ./dist/index.mjs
```

### lib/api-client-react neu bauen (nach Typ-Änderungen)
```bash
cd lib/api-client-react && npx tsc --build
```
Nötig wenn TypeScript-Deklarationsdateien in `dist/` veraltet sind (Fehler TS6305).

---

## Umgebungsvariablen

### Backend (`artifacts/api-server/.env`)
```env
PORT=8000
NODE_ENV=development
DATABASE_URL=postgresql://...      # Neon oder beliebige Postgres-Instanz
ANTHROPIC_API_KEY=sk-ant-...       # Claude API Key (Pflicht)
DEPARTMENT_WRITE_SECRET=...        # Legacy — nicht mehr primär genutzt
CLERK_PUBLISHABLE_KEY=pk_test_...  # Clerk — aus dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_...       # Clerk Secret (nur Backend!)
```

### Frontend (`artifacts/audi-innovation-hub/.env.local`)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  # Nur Publishable Key (kein Secret!)
```

**Sicherheit:** Alle `.env`-Dateien sind in `.gitignore`. `CLERK_SECRET_KEY` niemals ins Frontend!

**Dev ohne Clerk-Keys:** Wenn `CLERK_*`-Keys fehlen oder `REPLACE_ME` enthalten, deaktiviert das Backend Auth transparent (WARN-Log). Alle Routen sind dann offen — nur für lokale Entwicklung.

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Monorepo | pnpm workspaces, Node.js 24, TypeScript 5.9 |
| Backend | Express 5, Pino (Logging), CORS, multer (File Upload) |
| Datenbank | PostgreSQL (Neon) + Drizzle ORM + drizzle-zod |
| Validierung | Zod v4 |
| API-Codegen | Orval (OpenAPI → React-Query-Hooks + Zod-Schemas) — derzeit manuell erweitert |
| Frontend | React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query v5 |
| Animationen | Framer Motion |
| KI | Anthropic SDK (`claude-sonnet-4-6`) |
| Auth | Clerk (`@clerk/express` Backend, `@clerk/clerk-react` Frontend) |
| Build | esbuild (Bundle für Backend) |

---

## macOS-spezifisch

Port 5000 ist auf macOS oft belegt (AirPlay Receiver). API-Server läuft deshalb auf **8000**.

`pnpm-workspace.yaml` enthält auskommentierte darwin-Overrides für Rollup/Tailwind — bei Binary-Fehlern nach `pnpm install` diese prüfen.

---

## Datenbank-Schema (`lib/db/src/schema/applications.ts`)

```sql
-- Haupt-Anwendungstabelle
id               UUID PK (random)
createdAt        TIMESTAMP WITH TZ
status           ENUM('pending','routed','shortlisted','accepted','declined','archived')
companyName      TEXT NOT NULL
website          TEXT
stage            TEXT
teamSize         TEXT
transcript       JSONB NOT NULL DEFAULT []     ← Chat-Verlauf als [{role, content}]
structuredData   JSONB                         ← KI-extrahierte Felder
departmentScores JSONB                         ← [{departmentId, departmentName, score, justification}]
businessCases    JSONB                         ← Top-2-Abteilungen mit ~200-Wort-Brief
trackingToken    TEXT UNIQUE                   ← Öffentlicher Tracking-Link (UUID, kein Auth)
notes            TEXT                          ← Interne Notizen (Staff)
clerkUserId      TEXT                          ← Clerk-User-ID des Einreichers

-- Staff-Assessment-Felder (alle optional, nur von audi_staff / superuser beschreibbar)
rating           INTEGER                       ← 1–5 Sterne
next_step        TEXT                          ← Freier Text: nächster Schritt
requirements     JSONB                         ← [{id, text, done: bool}]
milestones       JSONB                         ← [{id, title, dueDate, status: 'pending'|'in_progress'|'done'}]
kpis             JSONB                         ← [{id, metric, target, current, unit}]
```

`conversations` + `messages` existieren im Schema, werden nicht genutzt (Legacy).

---

## Rollen-System (3 Ebenen)

```
superuser
  └── Vollzugriff: Admin-Dashboard + Staff-Dashboard + alle Seiten
      Kann allen anderen Usern Rollen zuweisen ohne Clerk-Dashboard

audi_staff
  └── Staff Application-Dashboard (/applications)
      Detail-Ansicht mit Bewertung, KPIs, Milestones, Next Steps
      Superuser können auch auf Staff-Seiten zugreifen

(kein role / applicant)
  └── Nur eigene Bewerbung einreichen und verfolgen
      /apply → /applications/:id (nur eigene)
```

### Erste Superuser-Einrichtung (einmalig)
Solange noch kein Superuser existiert, muss die Rolle manuell im Clerk Dashboard vergeben werden:
1. [dashboard.clerk.com](https://dashboard.clerk.com) → Users → Nutzer auswählen
2. **Edit public metadata** → eintragen:
   ```json
   { "role": "superuser" }
   ```
3. Ausloggen + einloggen auf `localhost:5173`
4. **Admin-Button** (gold, oben rechts) erscheint → danach alle Rollen über `/admin` verwalten

---

## Routen-Schutz

### Frontend (`src/App.tsx`)
| Route | Guard | Zugang |
|-------|-------|--------|
| `/` | — | Öffentlich |
| `/sign-in`, `/sign-in/*` | — | Öffentlich |
| `/track/:token` | — | Öffentlich |
| `/apply` | `<Protected>` | Jeder eingeloggte User |
| `/applications` | `<AudiStaffOnly>` | audi_staff **oder** superuser |
| `/applications/:id` | `<Protected>` | Eingeloggt (Backend prüft Ownership) |
| `/departments`, `/departments/:id` | `<AudiStaffOnly>` | audi_staff oder superuser |
| `/admin` | `<SuperuserOnly>` | Nur superuser |

### Backend (`artifacts/api-server/src/lib/auth.ts`)
| Middleware | Beschreibung |
|-----------|-------------|
| `requireAuth` | Valide Clerk-Session erforderlich (401 sonst) |
| `requireAudiStaff` | role === 'audi_staff' (403 sonst) |
| `requireSuperuser` | role === 'superuser' (403 sonst) |
| `getUserId(req)` | Gibt Clerk userId zurück oder null |
| `isAudiStaff(req)` | Boolean-Check auf audi_staff-Rolle |
| `isSuperuser(req)` | Boolean-Check auf superuser-Rolle |
| `CLERK_ENABLED` | Boolean-Export — false wenn Keys fehlen/Placeholder |

---

## API Endpoints

Alle Endpoints unter `/api/`:

### Bewerbungen
| Method | Pfad | Middleware | Beschreibung |
|--------|------|-----------|-------------|
| GET | `/healthz` | — | Health Check |
| POST | `/applications` | requireAuth | Einreichen → KI-Analyse synchron (~20–30s) |
| GET | `/applications` | requireAuth | Staff: alle; Bewerber: nur eigene |
| GET | `/applications/:id` | requireAuth | Detail (owner oder staff) |
| PATCH | `/applications/:id` | requireAudiStaff | Status, Notizen, Rating, NextStep, Requirements, Milestones, KPIs |
| GET | `/applications/track/:token` | — | Öffentlicher Tracker |
| POST | `/chat` | requireAuth | Chatbot-Konversation (Claude Tool Use) |
| POST | `/extract-pdf` | requireAuth | PDF-Pitch-Deck → Felder extrahieren |

### Admin
| Method | Pfad | Middleware | Beschreibung |
|--------|------|-----------|-------------|
| GET | `/admin/users` | requireSuperuser | Alle Clerk-User mit Rollen auflisten |
| PATCH | `/admin/users/:userId/role` | requireSuperuser | Rolle zuweisen (superuser/audi_staff/applicant/"") |
| DELETE | `/admin/users/:userId` | requireSuperuser | User aus Clerk löschen |

Die Admin-Routen nutzen `clerkClient()` aus `@clerk/express` um direkt mit der Clerk Backend API zu kommunizieren.

---

## Frontend-Seiten (`artifacts/audi-innovation-hub/src/pages/`)

| Route | Datei | Beschreibung |
|-------|-------|-------------|
| `/` | Home.tsx | Landingpage: PlantScene → FocusAreas → Benefits + rollenbasierter Nav oben rechts |
| `/apply` | Apply.tsx | Konversations-Chatbot + PDF-Upload + Submit |
| `/applications` | Applications.tsx | **Staff Dashboard**: Stats, Filter, Suche, Tabelle mit Scores/Rating |
| `/applications/:id` | Applications.tsx | Detail + AI-Analyse + **Staff Actions Panel** (rating, nextStep, requirements, milestones, KPIs) |
| `/departments` | DepartmentPortal.tsx | Abteilungsauswahl (Legacy Key-Gate) |
| `/departments/:id` | DepartmentPortal.tsx | Bewerbungen einer Abteilung |
| `/track/:token` | Track.tsx | Öffentlicher Status-Tracker |
| `/sign-in` | SignIn.tsx | Clerk `<SignIn routing="hash">` mit Audi-Styling |
| `/admin` | Admin.tsx | Superuser-Rollenverwaltung |

---

## Homepage Navigation (Home.tsx)

Die Top-Right-Navigation ist rollenbasiert (Komponente `TopRightNav`):
- **Superuser eingeloggt:** "Admin"-Button (gold) + "Dashboard"-Button + `UserButton`
- **Staff eingeloggt:** "Dashboard"-Button + `UserButton`
- **Applicant eingeloggt:** nur `UserButton`
- **Ausgeloggt:** "Staff Login"-Button → `/sign-in`

---

## Staff Dashboard (`Applications.tsx → ApplicationsList`)

Zeigt nur für `audi_staff` und `superuser`:
- **KPI-Karten:** Total / Pending / Shortlisted / Accepted / Declined (je klickbar als Filter)
- **Suche** nach Firmenname oder Stage
- **Status-Filter-Tabs:** All / Pending / Shortlisted / Accepted / Declined / Archived
- **Tabelle:** Company, Stage, Top AI Score (mit Bar), Star-Rating, Status-Badge, Datum
- Alle Zeilen klickbar → Detail-Ansicht

---

## Staff Actions Panel (`Applications.tsx → StaffPanel`)

Erscheint in `ApplicationDetail` **nur für audi_staff und superuser**.
Felder (alle lokal editierbar, "Save All Changes"-Button sendet `PATCH /api/applications/:id`):
- **Pipeline Status** — Dropdown (pending → routed → shortlisted → accepted → declined → archived)
- **Rating** — klickbare 1–5-Sterne (erneut klicken → deselect)
- **Internal Notes** — Textarea (nicht sichtbar für Bewerber)
- **Next Step** — Einzeiliges Textfeld (z.B. "Discovery Call mit R&D planen")
- **Requirements** — Checklist: add / check-done / delete
- **Milestones** — Titel + Datum + Status (Pending/In Progress/Done)
- **KPIs** — Metric / Target / Current / Unit (Tabellen-Layout)
- "Save All Changes"-Button unten mit grünem Flash-Feedback

---

## Admin Dashboard (`Admin.tsx`)

Nur für `superuser`. Nutzt die `/api/admin/*`-Endpoints:
- **Nutzer-Tabelle:** Avatar, Name, E-Mail, aktuelle Rolle als Badge, Datum
- **Rollenzuweisung:** Dropdown per User, Save-Button erscheint nur bei Änderung
- **Löschen:** Bestätigungsdialog vor endgültigem Delete
- **Statistik-Karten:** Gesamt / Superuser / Staff / Applicants
- **Suche + Rollenfilter**
- **Einrichtungshinweis** für erste Superuser-Vergabe (mit Clerk-Dashboard-Link)

---

## Bewerbungs-Chatbot (`Apply.tsx`)

**State:** `messages`, `collectedFields`, `isLoading`, `isPdfLoading`, `isSubmitting`

- **Header:** Audi-Logo links, `FieldProgress` + `UserButton` rechts
- **Pflichtfelder (7):** `companyName`, `problem`, `solution`, `technology`, `stage`, `teamSize`, `targetDepartments`
- **PDF-Upload:** Paperclip → `POST /api/extract-pdf` → Bot bestätigt gefundene/fehlende Felder
- **Submit-Button:** Erscheint inline wenn alle 7 Felder gesammelt
- **Submit:** `POST /api/applications` mit Transcript + extrahierten Feldern + Clerk-JWT
- **Auth:** `getToken()` aus `useAuth()` → `Authorization: Bearer <token>` für alle API-Calls
- **Nach Submit:** `SuccessScreen` mit Tracking-Link + Top-3-Abteilungs-Matches

---

## Chatbot-Backend (`chat.ts`)

```
POST /api/chat
Body:     { messages: [{role, content}][], collectedFields: Record<string, unknown> }
Response: { reply: string, extractedFields: Record<string, unknown> }
```

- Dynamischer System-Prompt basierend auf bereits gesammelten vs. fehlenden Feldern
- Claude Tool `save_startup_info` — extrahiert Felder während Konversation
- Follow-Up-Call wenn Claude nur das Tool aufruft (kein Text)
- Antwortet auf Deutsch oder Englisch je nach Nutzersprache

**Die 6 Audi-Abteilungen:**
```
production  → Production & Manufacturing
rd          → Research & Development
design      → Design Studio
logistics   → Logistics & Supply Chain
sales       → Sales & Customer Experience
digital     → Digital & IT
```

---

## PDF-Extraktion (`extract-pdf.ts`)

```
POST /api/extract-pdf
Body:     multipart/form-data, Feld "file" (PDF, max 20MB)
Response: { extracted: Record<string,unknown>, found: string[], missing: string[] }
```

- multer mit memoryStorage (kein Disk-Write)
- PDF als base64 an Claude (`type: "document"`, `source.type: "base64"`)
- `found` = extrahierte Pflichtfelder, `missing` = noch fehlende

---

## KI-Analyse bei Einreichung (`applications/analyze.ts`)

- **Trigger:** Jede `POST /applications` → sofortige synchrone Analyse
- **Modell:** `claude-sonnet-4-6`, max 8192 Tokens
- **Input:** Kompletter Chat-Transcript
- **Output:** `structuredData` + `departmentScores` (6 Abteilungen, 0–100) + `businessCases` (Top-2 mit ~200-Wort-Brief)
- **Fallback:** Bei KI-Fehler wird Bewerbung trotzdem mit Status `pending` gespeichert

---

## PlantScene (`components/PlantScene.tsx`)

3D-Isometrische Ansicht des Audi-Campus. Wichtige Details:
- **Gebäude klickbar:** Polygon-Hit-Zones öffnen `DeptCard`-Popup
- **DeptCard** hat `onApply`-Prop → navigiert zu `/apply` (via wouter `useLocation`)
- **`AnimatePresence mode="wait"`** verhindert überlappende Karten-Animationen
- **Audi-Logo** oben links (animated, `public/audi-logo.png`)

---

## Assets

- `artifacts/audi-innovation-hub/public/audi-logo.png` — Vieringe-Logo, transparenter Hintergrund (Pillow)
  - Eingebunden in: PlantScene.tsx, Apply.tsx, Applications.tsx, Admin.tsx

---

## Zod / Typ-Erweiterungen (manuell nach Codegen-Override)

Die folgenden Typen wurden **manuell** in den generierten Dateien erweitert:

### `lib/api-zod/src/generated/api.ts` — `UpdateApplicationBody`
Zusätzliche optionale Felder:
```typescript
rating:       number (1–5) | null
nextStep:     string
requirements: [{id, text, done}]
milestones:   [{id, title, dueDate?, status: 'pending'|'in_progress'|'done'}]
kpis:         [{id, metric, target, current, unit?}]
```

### `lib/api-client-react/src/generated/api.schemas.ts`
- `Application` — neue Felder: `rating`, `nextStep`, `requirements`, `milestones`, `kpis`
- `ApplicationUpdateInput` — entsprechende optionale Felder
- Neue Interfaces: `RequirementItem`, `MilestoneItem`, `KpiItem`

Nach `npx tsc --build` in `lib/api-client-react` müssen die `.d.ts`-Dateien in `dist/` aktualisiert sein.

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

**Achtung:** Nach einem Codegen-Lauf gehen die manuellen Erweiterungen (Staff-Assessment-Felder, Admin-Typen) verloren. Entweder:
- Codegen läuft zuerst, dann manuelle Änderungen erneut eintragen, oder
- OpenAPI-Spec um die neuen Felder ergänzen damit Codegen sie direkt generiert (empfohlen langfristig)

---

## Bekannte Eigenheiten & Fallstricke

- **Nur pnpm:** `preinstall`-Hook blockiert npm/yarn.
- **Supply-Chain-Schutz:** `.npmrc` hat `minimumReleaseAge: 1440`.
- **esbuild-Override:** `esbuild: "0.27.3"` als Override wegen Drizzle-Kit — nicht ändern.
- **JSONB-Typen:** `departmentScores`, `businessCases`, `transcript`, `requirements`, `milestones`, `kpis` sind JSONB — immer casten.
- **KI synchron:** Claude-Analyse beim POST (~20–30s). Frontend zeigt Spinner.
- **Track-Token öffentlich:** UUID, kein Auth. Gibt nur `companyName`, `status`, `createdAt`, `departmentScores` zurück.
- **Session-Claims:** Nach Rollenänderung in Clerk oder im Admin-Dashboard muss der User **aus- und einloggen**, damit die neuen Claims in `sessionClaims.publicMetadata` erscheinen.
- **clerkClient():** In `@clerk/express` wird `clerkClient` als Funktion aufgerufen (`await clerkClient()`) — nicht direkt als Objekt nutzen.
- **`CLERK_ENABLED` Flag:** Exportiert aus `auth.ts` — prüft ob Keys real sind. Bei `false` sind alle Auth-Middleware No-Ops.
- **Wouter `routing="hash"`:** Clerk's Sign-In navigiert intern zu Sub-Paths (`/sign-in/factor-one` etc.). Gelöst durch `routing="hash"` in `SignIn.tsx` + Wildcard-Route `/sign-in/:rest*` in `App.tsx`.
- **Vite Proxy:** Nur aktiv wenn `REPL_ID` nicht gesetzt (kein Replit). Proxyt `/api` → `localhost:8000`.
- **API-Server kein Hot-Reload:** esbuild-Build + Node-Start. Nach Backend-Änderungen immer neu starten.
- **Port 5000:** macOS AirPlay Receiver belegt Port 5000 → API-Server auf 8000.

---

## TODOs / Noch nicht implementiert

- Codegen-Flow um Staff-Assessment-Felder in OpenAPI-Spec erweitern (statt manueller Typ-Patch)
- Pagination für `/applications` (alle auf einmal geladen)
- E-Mail-Benachrichtigung bei Statusänderung
- Department Portal (`/departments`) auf Clerk-Auth umstellen (aktuell noch Legacy Key-Gate mit `DEPARTMENT_WRITE_SECRET`)
- `mockup-sandbox` ist nur Replit-Prototyp — kein produktiver Code
