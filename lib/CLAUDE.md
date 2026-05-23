# lib/ — Shared Libraries CLAUDE.md

> Alle geteilten Pakete des Monorepos. Werden von `api-server` und `audi-innovation-hub` importiert.

---

## Übersicht

```
lib/
├── db/                        @workspace/db
│   └── Drizzle ORM Schema + PostgreSQL-Client
│       → Wird nur vom API-Server importiert
│
├── api-spec/                  (kein @workspace-Name)
│   └── openapi.yaml           ← Einzige Wahrheitsquelle für alle API-Typen
│   └── orval.config.ts        ← Codegen-Konfiguration
│
├── api-zod/                   @workspace/api-zod
│   └── Zod-Schemas + TypeScript-Typen (aus openapi.yaml generiert)
│   ⚠️ MANUELL ERWEITERT nach letztem Codegen
│   → Wird vom API-Server zur Request-Validierung importiert
│
├── api-client-react/          @workspace/api-client-react
│   └── React-Query-Hooks + Fetch-Funktionen (aus openapi.yaml generiert)
│   ⚠️ MANUELL ERWEITERT nach letztem Codegen
│   → Wird vom Frontend importiert
│
└── integrations-anthropic-ai/ @workspace/integrations-anthropic-ai
    └── Anthropic SDK Client-Wrapper (exportiert `anthropic`-Instanz)
    → Wird vom API-Server importiert
```

---

## Abhängigkeitsgraph

```
openapi.yaml
    │
    │ pnpm --filter @workspace/api-spec run codegen
    ▼
api-zod/src/generated/        api-client-react/src/generated/
      │                                    │
      │ (Zod, TS-Typen)                   │ (React-Query-Hooks, Fetch-Fns)
      ▼                                    ▼
api-server/                       audi-innovation-hub/
(Validierung)                     (API-Calls)
```

---

## Codegen-Flow ⚠️

```bash
# Starten aus lib/api-spec/
pnpm --filter @workspace/api-spec run codegen

# Was passiert:
# 1. Orval liest openapi.yaml
# 2. Schreibt in lib/api-zod/src/generated/        → Zod + TS-Typen
# 3. Schreibt in lib/api-client-react/src/generated/ → Hooks + Fetch-Fns

# NACH jedem Codegen:
# → Manuelle Ergänzungen in api-zod + api-client-react erneut eintragen! (siehe unten)
```

---

## Manuelle Erweiterungen (nach letztem Codegen hinzugefügt)

Diese Felder sind in `openapi.yaml` NOCH NICHT, aber im Code vorhanden:

**`lib/api-zod/src/generated/api.ts` — `UpdateApplicationBody`:**
```typescript
rating:       z.number().min(1).max(5).nullable().optional()
nextStep:     z.string().optional()
requirements: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).optional()
milestones:   z.array(z.object({ id, title, dueDate?, status: 'pending'|'in_progress'|'done' })).optional()
kpis:         z.array(z.object({ id, metric, target, current, unit? })).optional()
```

**`lib/api-client-react/src/generated/api.schemas.ts`:**
- `Application` + `ApplicationUpdateInput` — gleiche Felder wie oben
- Interfaces: `RequirementItem`, `MilestoneItem`, `KpiItem`

**Langfristige Lösung:** Diese Felder in `openapi.yaml` eintragen → dann generiert Orval sie automatisch.

---

## Typen-Build (ohne Codegen)

Wenn nur Typen in `api-client-react` geändert wurden:
```bash
cd lib/api-client-react && npx tsc --build
# Aktualisiert dist/*.d.ts → Frontend sieht neue Typen
```

Nötig wenn TypeScript-Fehler `TS6305: Output file ... has not been built` erscheinen.
