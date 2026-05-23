# API Server — CLAUDE.md

> Express 5 Backend, Port 8000. Empfängt Clerk-JWT im Authorization-Header, validiert mit Zod, schreibt in Postgres, ruft Claude auf.

---

## Starten

```bash
pnpm --filter @workspace/api-server run dev
# = set -a && . ./.env && set +a && node ./build.mjs && node --enable-source-maps ./dist/index.mjs
```

**Kein Hot-Reload.** Nach jeder Änderung: `Ctrl+C` → neu starten.

---

## Dateistruktur

```
src/
├── app.ts                         ← Express-App: CORS, Clerk-Middleware, Router-Mount
├── index.ts                       ← Server-Start (Port aus .env)
├── lib/
│   ├── auth.ts                    ← requireAuth / requireAudiStaff / requireSuperuser + CLERK_ENABLED
│   └── logger.ts                  ← Pino-Logger
└── routes/
    ├── index.ts                   ← Mountet alle Router unter /api
    ├── health.ts                  ← GET /healthz
    ├── chat.ts                    ← POST /chat (Chatbot, Claude Tool Use)
    ├── extract-pdf.ts             ← POST /extract-pdf (multer + Claude)
    ├── applications/
    │   ├── index.ts               ← CRUD für /applications
    │   └── analyze.ts             ← KI-Analyse: Scores + Business Cases
    └── admin/
        └── index.ts               ← GET+PATCH+DELETE /admin/users (Clerk Backend API)
```

---

## Alle Endpoints

### Public
| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/healthz` | Health Check |
| GET | `/api/applications/track/:token` | Öffentlicher Status (kein Auth) → gibt `companyName, status, createdAt, departmentScores` |

### requireAuth (jeder eingeloggte User)
| Method | Pfad | Beschreibung |
|--------|------|-------------|
| POST | `/api/applications` | Bewerbung einreichen → speichern → KI-Analyse → Status `routed` |
| GET | `/api/applications` | Staff: alle; Bewerber: nur eigene (gefiltert nach `clerkUserId`) |
| GET | `/api/applications/:id` | Detail (Owner oder Staff; 403 sonst) |
| POST | `/api/chat` | Chatbot-Konversation (Claude Tool Use) |
| POST | `/api/extract-pdf` | PDF → Claude → extrahierte Felder |

### requireAudiStaff (role = audi_staff oder superuser)
| Method | Pfad | Beschreibung |
|--------|------|-------------|
| PATCH | `/api/applications/:id` | Status, Notes, Rating, NextStep, Requirements, Milestones, KPIs |

### requireSuperuser (role = superuser only)
| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/admin/users` | Alle Clerk-User mit Rollen |
| PATCH | `/api/admin/users/:userId/role` | Rolle setzen (`superuser`/`audi_staff`/`""`) |
| DELETE | `/api/admin/users/:userId` | User aus Clerk löschen |

---

## Auth-System (`src/lib/auth.ts`)

```typescript
CLERK_ENABLED  // false wenn Keys fehlen/REPLACE_ME → alle Middleware sind No-Ops

requireAuth         // 401 wenn kein userId
requireAudiStaff    // 403 wenn role !== 'audi_staff' (superuser kommt durch, da separate Prüfung)
requireSuperuser    // 403 wenn role !== 'superuser'

getUserId(req)      // → string | null  (Clerk userId)
isAudiStaff(req)    // → boolean  (liest sessionClaims.publicMetadata.role)
isSuperuser(req)    // → boolean
```

**Rolle liegt in:** `sessionClaims.publicMetadata.role` → gesetzt über Clerk-Dashboard oder `/admin`-Endpoint.

**Achtung:** `requireAudiStaff` lässt Superuser NICHT automatisch durch — Frontend prüft das selbst. Für Staff-Endpoints im Backend prüfe beide: `isAudiStaff(req) || isSuperuser(req)`.

---

## POST /api/applications — Datenfluss

```
1. Zod-Parse: SubmitApplicationBody  (companyName, transcript, ...)
2. INSERT in applicationsTable       (status = 'pending', trackingToken = randomUUID)
3. analyzeApplication(transcript)    → claude-sonnet-4-6 (~20–30s)
     └── gibt zurück: structuredData + departmentScores[6] + businessCases[2]
4. UPDATE applicationsTable          (status = 'routed', alle AI-Felder)
5. res.status(201).json(updated)

Bei KI-Fehler: res.status(201).json(app)  ← Bewerbung bleibt mit status='pending'
```

---

## POST /api/chat — Datenfluss

```
Body: { messages: [{role,content}][], collectedFields: {} }

1. System-Prompt: listet fehlende vs. gesammelte Pflichtfelder auf
2. Claude-Call mit Tool: save_startup_info { companyName, problem, solution, ... }
3. Wenn Claude nur Tool aufruft (kein Text): Follow-Up-Call für menschliche Antwort
4. Response: { reply: string, extractedFields: {} }
```

**Pflichtfelder:** `companyName`, `problem`, `solution`, `technology`, `stage`, `teamSize`, `targetDepartments`

---

## POST /api/extract-pdf — Datenfluss

```
Body: multipart/form-data, Feld "file" (PDF, max 20MB)

1. multer memoryStorage → file.buffer
2. base64-encode
3. Claude: { type: "document", source: { type: "base64", media_type: "application/pdf", data: ... } }
4. Response: { extracted: {}, found: string[], missing: string[] }
```

---

## KI-Analyse (`routes/applications/analyze.ts`)

Prompt gibt folgende JSON-Struktur vor:
```json
{
  "structuredData": { "companyName", "problemStatement", "solution", "technology", ... },
  "departmentScores": [
    { "departmentId": "production|rd|design|logistics|sales|digital",
      "departmentName": "...", "score": 0-100, "justification": "..." }
  ],
  "businessCases": [
    { "departmentId": "...", "departmentName": "...", "brief": "~200 Wörter" }
  ]
}
```
Nur die **Top-2** Abteilungen erhalten einen Business Case Brief.

---

## PATCH /api/applications/:id — Akzeptierte Felder

```typescript
status:       'pending'|'routed'|'shortlisted'|'accepted'|'declined'|'archived'
notes:        string
rating:       number (1–5) | null
nextStep:     string
requirements: [{ id: string, text: string, done: boolean }]
milestones:   [{ id: string, title: string, dueDate?: string, status: 'pending'|'in_progress'|'done' }]
kpis:         [{ id: string, metric: string, target: string, current: string, unit?: string }]
```

Alle Felder optional — nur gesetzte werden im UPDATE übernommen.

---

## Env-Variablen

```env
PORT=8000
NODE_ENV=development
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DEPARTMENT_WRITE_SECRET=...   # Legacy, nicht mehr genutzt
```

---

## Typische Fehlerquellen

- **`clerkClient()` als Funktion:** `await clerkClient()` → dann `.users.getUser(id)` etc.
- **JSONB-Casts:** Drizzle gibt JSONB als `unknown` — immer nach dem Lesen casten
- **Backend neu starten vergessen** nach Code-Änderung (kein HMR)
- **requireAudiStaff lässt Superuser nicht durch** — wenn ein Endpoint für beide gilt: eigene Prüfung schreiben oder beide Middlewares prüfen
