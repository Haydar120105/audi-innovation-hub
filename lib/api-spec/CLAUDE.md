# lib/api-spec — CLAUDE.md

> Einzige Wahrheitsquelle für alle API-Typen. OpenAPI 3.1 YAML + Orval-Codegen.

---

## Dateien

```
lib/api-spec/
├── openapi.yaml        ← HIER alle API-Typen und Endpoints definieren
└── orval.config.ts     ← Codegen-Konfiguration (Orval)
```

---

## openapi.yaml — Struktur

```yaml
servers:
  - url: /api          ← alle Endpoints sind unter /api

paths:
  /healthz              GET  → HealthStatus
  /applications         POST (submitApplication) + GET (listApplications)
  /applications/{id}    GET (getApplication) + PATCH (updateApplication)
  /applications/track/{token}  GET (trackApplication) — öffentlich

components/schemas:
  ApplicationInput        ← POST body beim Einreichen
  ApplicationUpdateInput  ← PATCH body (status, notes — NOCH OHNE Staff-Assessment-Felder!)
  ApplicationSummary      ← GET /applications (Liste)
  Application             ← GET /applications/:id (Detail)
  ApplicationTracking     ← GET /track/:token (öffentlich, nur companyName/status/scores)
  DepartmentScore         ← {departmentId, departmentName, score, justification}
  BusinessCase            ← {departmentId, departmentName, brief}
  TranscriptMessage       ← {role, content}
```

---

## Codegen ausführen

```bash
pnpm --filter @workspace/api-spec run codegen

# Schreibt in:
# → lib/api-zod/src/generated/       (Zod-Schemas + TS-Typen)
# → lib/api-client-react/src/generated/  (React-Query-Hooks + Fetch-Fns)
```

---

## ⚠️ Manuelle Erweiterungen WERDEN ÜBERSCHRIEBEN

Folgende Felder sind manuell in `api-zod` und `api-client-react` ergänzt, aber NICHT in `openapi.yaml`:

```
ApplicationUpdateInput:  rating, nextStep, requirements, milestones, kpis
Application:             rating, nextStep, requirements, milestones, kpis
ApplicationSummary:      rating (für Staff-Rating in der Liste)
Interfaces:              RequirementItem, MilestoneItem, KpiItem
```

**Nach jedem Codegen:** Manuelle Ergänzungen erneut in `api-zod` und `api-client-react` eintragen.

**Empfehlung:** Diese Felder endgültig in `openapi.yaml` ergänzen:

```yaml
# In ApplicationUpdateInput:
properties:
  rating:
    type: integer
    minimum: 1
    maximum: 5
    nullable: true
  nextStep:
    type: string
  requirements:
    type: array
    items:
      $ref: "#/components/schemas/RequirementItem"
  milestones:
    type: array
    items:
      $ref: "#/components/schemas/MilestoneItem"
  kpis:
    type: array
    items:
      $ref: "#/components/schemas/KpiItem"

# Neue Schemas:
RequirementItem:
  type: object
  properties:
    id: { type: string }
    text: { type: string }
    done: { type: boolean }
  required: [id, text, done]

MilestoneItem:
  type: object
  properties:
    id: { type: string }
    title: { type: string }
    dueDate: { type: string }
    status: { type: string, enum: [pending, in_progress, done] }
  required: [id, title, status]

KpiItem:
  type: object
  properties:
    id: { type: string }
    metric: { type: string }
    target: { type: string }
    current: { type: string }
    unit: { type: string }
  required: [id, metric, target, current]
```

---

## Orval-Konfiguration (`orval.config.ts`)

- **api-zod:** Generiert Zod-Schemas → `lib/api-zod/src/generated/`
- **api-client-react:** Generiert React-Query-Hooks mit `axios`-ähnlichem Custom-Fetch → `lib/api-client-react/src/generated/`
- Basis-URL: `/api` (aus `servers[0].url` im YAML)
