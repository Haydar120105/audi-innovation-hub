# lib/db — CLAUDE.md

> PostgreSQL-Schema mit Drizzle ORM. Wird ausschließlich vom API-Server genutzt.

---

## Paket-Name: `@workspace/db`

```typescript
import { db, applicationsTable } from "@workspace/db";
```

---

## Schema (`src/schema/applications.ts`)

```typescript
applicationsTable (PostgreSQL-Tabelle "applications")
│
├── id              UUID PK (auto: gen_random_uuid)
├── createdAt       TIMESTAMP WITH TZ (auto: now)
├── status          ENUM: 'pending'|'routed'|'shortlisted'|'accepted'|'declined'|'archived'
├── companyName     TEXT NOT NULL
├── website         TEXT nullable
├── stage           TEXT nullable           z.B. "seed", "series-a"
├── teamSize        TEXT nullable           z.B. "6-15"
├── clerkUserId     TEXT nullable           ← Clerk User-ID des Einreichers
├── trackingToken   TEXT UNIQUE (auto: gen_random_uuid::text)  ← öffentlicher Link, kein Auth
│
├── transcript      JSONB NOT NULL []       ← [{role: 'user'|'assistant', content: string}]
├── structuredData  JSONB nullable          ← KI-extrahiert: {companyName, problemStatement, ...}
├── departmentScores JSONB nullable         ← [{departmentId, departmentName, score 0-100, justification}]
├── businessCases   JSONB nullable          ← [{departmentId, departmentName, brief}] (Top-2)
│
├── notes           TEXT nullable           ← Interne Staff-Notizen (nicht sichtbar für Bewerber)
│
├── [Staff-Assessment-Felder]
│   ├── rating          INTEGER nullable     ← 1–5 Sterne
│   ├── nextStep        TEXT nullable        ← freier Text, z.B. "Discovery Call planen"
│   ├── requirements    JSONB nullable       ← [{id, text, done: bool}]
│   ├── milestones      JSONB nullable       ← [{id, title, dueDate?, status: 'pending'|'in_progress'|'done'}]
│   └── kpis            JSONB nullable       ← [{id, metric, target, current, unit?}]
│
└── [Onboarding-Felder — gesetzt wenn Superuser zuweist]
    ├── assignedEmployee JSONB nullable      ← { name, role, email, department, clerkId }
    │                                           clerkId verknüpft mit Clerk-User des Staff-Members
    └── ndaStatus        TEXT nullable       ← 'pending_signature' | 'signed'
```

---

## Status-Flow

```
pending  →  routed  →  shortlisted  →  accepted
   │            │                          │
   └────────────┴──────────────────────────┴→  declined
                                                    │
                                                 archived
```

- `pending`: Gerade eingetragen, KI-Analyse noch nicht fertig (oder fehlgeschlagen)
- `routed`: KI-Analyse abgeschlossen, departmentScores gesetzt
- Alle weiteren Status: Manuelle Staff-/Superuser-Entscheidung via `PATCH /api/applications/:id`

---

## assignedEmployee — Wichtig

Das Feld steuert die Sichtbarkeit im Staff-Dashboard:

```typescript
// Backend-Query für audi_staff-Sicht:
.where(sql`${applicationsTable.assignedEmployee}->>'clerkId' = ${userId}`)

// Struktur die gespeichert wird:
assignedEmployee: {
  name: "Max Mustermann",
  role: "Innovation Manager",
  email: "m.mustermann@audi.de",
  department: "Research & Development",
  clerkId: "user_abc123"    // ← Clerk-ID des Staff-Users
}
```

**Staff ohne `clerkId` im assignedEmployee** sieht keine Bewerbungen (leere Liste, nicht Fehler).

---

## Schema ändern

```bash
# 1. Datei bearbeiten
vim lib/db/src/schema/applications.ts

# 2. Migration/Push zu Neon
pnpm --filter @workspace/db run push
# = drizzle-kit push → vergleicht Schema mit DB, wendet Änderungen an (keine Migrationen-Dateien)

# 3. Typen in api-zod / api-client-react aktualisieren (manuell oder Codegen)
```

**Achtung:** `drizzle-kit push` ist direkt (kein Migration-File). Produktiv lieber `generate` + `migrate` verwenden.

---

## Drizzle-Config (`drizzle.config.ts`)

```typescript
schema: "./src/schema/applications.ts"
out:    "./drizzle"
dialect: "postgresql"
dbCredentials: { url: process.env.DATABASE_URL }
```

---

## JSONB-Eigenheit

Drizzle gibt JSONB-Felder als `unknown` zurück. Immer casten:
```typescript
const scores = app.departmentScores as DepartmentScore[] | null;
const reqs = app.requirements as { id: string; text: string; done: boolean }[] | null;
const assigned = app.assignedEmployee as { name: string; role: string; email: string; department: string; clerkId: string } | null;
```

Beim Schreiben ebenfalls casten:
```typescript
requirements: body.data.requirements as unknown as Record<string, unknown>[]
assignedEmployee: body.data.assignedEmployee as unknown as Record<string, unknown>
```

---

## Datenbankverbindung (`src/index.ts`)

```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

export const db = drizzle(neon(process.env.DATABASE_URL!));
export { applicationsTable } from "./schema/applications";
```

---

## Legacy (ignorieren)

- `conversations` + `messages` Tabellen existieren im Schema aber werden nicht genutzt
