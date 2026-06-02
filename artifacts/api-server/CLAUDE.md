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
    ├── chat.ts                    ← POST /chat (Chatbot, Zwei-Call-Muster)
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
| GET | `/api/applications` | Superuser: alle; Staff: nur zugewiesene; Bewerber: nur eigene |
| GET | `/api/applications/:id` | Superuser: immer; Staff: nur wenn zugewiesen; Owner: eigene |
| POST | `/api/chat` | Chatbot-Konversation (Zwei-Call: Extraktion + Reply) |
| POST | `/api/extract-pdf` | PDF → Claude → extrahierte Felder |

### requireAudiStaff (role = audi_staff oder superuser)
| Method | Pfad | Beschreibung |
|--------|------|-------------|
| PATCH | `/api/applications/:id` | Status, Notes, Rating, NextStep, Requirements, Milestones, KPIs, AssignedEmployee, NdaStatus |

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
requireAudiStaff    // 403 wenn role !== 'audi_staff' und !== 'superuser'
requireSuperuser    // 403 wenn role !== 'superuser'

getUserId(req)      // → string | null  (Clerk userId)
isAudiStaff(req)    // → boolean  (liest sessionClaims.publicMetadata.role)
isSuperuser(req)    // → boolean
```

**Rolle liegt in:** `sessionClaims.publicMetadata.role` → gesetzt über Clerk-Dashboard oder `/admin`-Endpoint.

**Rollen direkt per Clerk API prüfen** (statt JWT-Claims) wenn aktuelle Metadaten gebraucht werden:
```typescript
const { createClerkClient } = await import("@clerk/express");
const clerkUser = await createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] }).users.getUser(userId);
const role = clerkUser.publicMetadata?.["role"] as string | undefined;
```

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

## POST /api/chat — Zwei-Call-Muster

```
Body: { messages: [{role,content}][], collectedFields: {} }

── CALL 1: Extraktion ──────────────────────────────────────────────
system: "Du bist ein Daten-Extraktor. Rufe save_startup_info auf..."
tool_choice: { type: "any" }        ← zwingt Claude zum Tool-Call
→ extractedFields: nur neu extrahierte Felder aus diesem Turn

── CALL 2: Konversations-Antwort ───────────────────────────────────
mergedFields = { ...collectedFields, ...extractedFields }
system: buildReplyPrompt(mergedFields)   ← kennt exakten Stand NACH Extraktion
tool_choice: keins                       ← nur Text, kein Tool-Overhead
→ replyText: 2–3 Sätze, führt Konversation weiter

Response: { reply: string, extractedFields: {}, currentField: string|null }
```

**`currentField`** = erster noch-fehlender Pflichtfeld-Name — steuert welche Quick-Reply-Chips das Frontend anzeigt.

**Pflichtfelder (in Reihenfolge):** `companyName`, `problem`, `solution`, `technology`, `stage`, `teamSize`, `targetDepartments`

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

## GET /api/applications — Sichtbarkeits-Logik

```typescript
if (role === "superuser") → alle Bewerbungen
if (role === "audi_staff") → nur WHERE assignedEmployee->>'clerkId' = userId
else (Bewerber) → nur WHERE clerkUserId = userId
```

JSONB-Query in Drizzle:
```typescript
import { sql } from "drizzle-orm";
.where(sql`${applicationsTable.assignedEmployee}->>'clerkId' = ${userId}`)
```

---

## PATCH /api/applications/:id — Akzeptierte Felder

```typescript
status:           'pending'|'routed'|'shortlisted'|'accepted'|'declined'|'archived'
notes:            string
rating:           number (1–5) | null
nextStep:         string
requirements:     [{ id: string, text: string, done: boolean }]
milestones:       [{ id: string, title: string, dueDate?: string, status: 'pending'|'in_progress'|'done' }]
kpis:             [{ id: string, metric: string, target: string, current: string, unit?: string }]
assignedEmployee: { name: string, role: string, email: string, department: string, clerkId: string }
ndaStatus:        'pending_signature' | 'signed'
```

**Berechtigungen:** `audi_staff` darf nur Bewerbungen patchen, die ihm zugewiesen sind (`assignedEmployee.clerkId === patcherId`). Superuser darf alles.

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

- **`createClerkClient` als Fabrik aufrufen:** `createClerkClient({ secretKey })` — gibt Instanz zurück, dann `.users.getUser(id)`
- **JSONB-Casts:** Drizzle gibt JSONB als `unknown` — immer nach dem Lesen casten
- **Backend neu starten vergessen** nach Code-Änderung (kein HMR)
- **`requireAudiStaff` lässt Superuser durch** (geprüft via Clerk API), aber zusätzliche Ownership-Checks laufen danach nochmal
- **Zwei-Call-Chat:** Call 1 extrahiert, Call 2 antwortet — nie beides in einem Call, da Text mit staler Feldliste generiert würde
