# lib/api-client-react — CLAUDE.md

> Generierte React-Query-Hooks + Fetch-Funktionen. Wird vom Frontend importiert als `@workspace/api-client-react`.

---

## ⚠️ Manuell erweitert — Codegen überschreibt!

Diese Datei enthält **generierte + manuell ergänzte** Typen. Codegen-Lauf aus `api-spec` würde die manuellen Änderungen überschreiben.

---

## Dateistruktur

```
src/
├── custom-fetch.ts         ← HTTP-Client: hängt Clerk-JWT + /api-Prefix an
├── index.ts               ← Re-exportiert alles
└── generated/
    ├── api.ts             ← React-Query-Hooks + Fetch-Funktionen (GENERIERT)
    └── api.schemas.ts     ← TypeScript-Interfaces (GENERIERT + MANUELL ERWEITERT)
dist/                      ← Compiliertes Output (.d.ts + .js)
```

---

## Alle exportierten Hooks

```typescript
// Health
useHealthCheck()

// Bewerbungen (lesen)
useListApplications()          // GET /api/applications
                               // → Staff: alle; Bewerber: nur eigene (Backend filtert!)
useGetApplication({ id })      // GET /api/applications/:id
useTrackApplication({ token }) // GET /api/applications/track/:token — kein Auth

// Bewerbungen (schreiben)
useSubmitApplication()         // POST /api/applications (mutation)
useUpdateApplication()         // PATCH /api/applications/:id (mutation)
```

---

## Verwendung im Frontend

```tsx
import {
  useListApplications,
  useGetApplication,
  useSubmitApplication,
  useUpdateApplication,
} from "@workspace/api-client-react";
import type {
  ApplicationSummary,
  Application,
  RequirementItem,
  MilestoneItem,
  KpiItem,
} from "@workspace/api-client-react";

// Lesen
const { data: apps, isLoading, error } = useListApplications();

// Schreiben
const { mutateAsync: submit } = useSubmitApplication();
await submit({ companyName: "...", transcript: [...] });

// Staff-Update
const { mutateAsync: update } = useUpdateApplication();
await update({ id: "...", status: "shortlisted", rating: 4, nextStep: "Call planen" });
```

---

## custom-fetch.ts — Auth-Header

```typescript
// Holt Clerk-JWT und setzt Authorization-Header
// Basis-URL: /api (relative → Vite proxy → localhost:8000)
```

Der Custom-Fetch wird von Orval als HTTP-Client konfiguriert. Clerk-JWT wird per `getToken()` aus dem Clerk-Context geholt und als `Authorization: Bearer <token>` gesendet.

---

## Manuell ergänzte Typen (`api.schemas.ts`)

```typescript
// Interfaces (nicht aus openapi.yaml generiert):
interface RequirementItem { id: string; text: string; done: boolean; }
interface MilestoneItem   { id: string; title: string; dueDate?: string; status: 'pending'|'in_progress'|'done'; }
interface KpiItem         { id: string; metric: string; target: string; current: string; unit?: string; }

// Application (erweitert um Staff-Felder):
interface Application {
  // ... generierte Felder ...
  rating?: number | null;
  nextStep?: string;
  requirements?: RequirementItem[];
  milestones?: MilestoneItem[];
  kpis?: KpiItem[];
}

// ApplicationUpdateInput (erweitert):
interface ApplicationUpdateInput {
  status?: string;
  notes?: string;
  rating?: number | null;
  nextStep?: string;
  requirements?: RequirementItem[];
  milestones?: MilestoneItem[];
  kpis?: KpiItem[];
}
```

---

## Typen neu bauen

```bash
cd lib/api-client-react && npx tsc --build
```

Nötig wenn:
- TS-Fehler `TS6305: Output file ... has not been built` erscheint
- Typen in `src/` geändert wurden und `dist/*.d.ts` veraltet sind

---

## Query-Keys (für Cache-Invalidierung)

```typescript
import { getListApplicationsQueryKey, getGetApplicationQueryKey } from "@workspace/api-client-react";

const queryClient = useQueryClient();
await queryClient.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
await queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey({ id }) });
```
