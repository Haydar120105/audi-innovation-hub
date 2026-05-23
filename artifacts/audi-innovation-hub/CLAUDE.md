# Frontend (audi-innovation-hub) — CLAUDE.md

> React 19 + Vite 7 + Tailwind v4 + Wouter + TanStack Query v5 + Framer Motion + Clerk.
> Port 5173. Vite proxyt `/api/*` → `localhost:8000`.

---

## Starten

```bash
pnpm --filter @workspace/audi-innovation-hub run dev
```

---

## Dateistruktur

```
src/
├── App.tsx                    ← Router + Route Guards (Protected / AudiStaffOnly / SuperuserOnly)
├── index.css                  ← Tailwind v4 + CSS-Variablen (Farben, Fonts)
├── pages/
│   ├── Home.tsx               ← Landingpage: PlantScene + Sections + rollenbasierter Nav
│   ├── Apply.tsx              ← Chatbot-Bewerbung + PDF-Upload + Submit
│   ├── Dashboard.tsx          ← Bewerber-Dashboard (eigene Bewerbungen)
│   ├── Applications.tsx       ← Staff-Dashboard (alle Bewerbungen) + Detail + Staff-Panel
│   ├── DepartmentPortal.tsx   ← Abteilungsportal (Staff, Legacy Key-Gate)
│   ├── Track.tsx              ← Öffentlicher Tracking-Link (/track/:token)
│   ├── SignIn.tsx             ← Clerk <SignIn routing="hash">
│   ├── SignUp.tsx             ← Clerk <SignUp routing="hash">
│   ├── Admin.tsx              ← Superuser: Nutzerverwaltung + Rollenzuweisung
│   └── not-found.tsx          ← 404
└── components/
    ├── PlantScene.tsx         ← Isometrische 3D-Fabrik-Szene (SVG + Framer Motion)
    ├── FocusAreas.tsx         ← "Was erwartet dich"-Section + Apply-Button
    ├── Benefits.tsx           ← Vorteile-Section
    └── Testimonials.tsx       ← Testimonials + Partner-Grid + Footer
```

---

## Alle Routen

| Pfad | Guard | Seite | Wer sieht es |
|------|-------|-------|-------------|
| `/` | — | Home.tsx | Alle |
| `/sign-in`, `/sign-in/:rest*` | — | SignIn.tsx | Alle |
| `/sign-up`, `/sign-up/:rest*` | — | SignUp.tsx | Alle |
| `/track/:token` | — | Track.tsx | Alle (öffentlich) |
| `/dashboard` | Protected | Dashboard.tsx | Eingeloggte Bewerber |
| `/apply` | Protected | Apply.tsx | Alle eingeloggten User |
| `/applications` | AudiStaffOnly | Applications.tsx | audi_staff + superuser |
| `/applications/:id` | Protected | Applications.tsx | Eingeloggt (Backend prüft Ownership) |
| `/departments` | AudiStaffOnly | DepartmentPortal.tsx | audi_staff + superuser |
| `/departments/:id` | AudiStaffOnly | DepartmentPortal.tsx | audi_staff + superuser |
| `/admin` | SuperuserOnly | Admin.tsx | Nur superuser |

**Neue Seite hinzufügen:** 1) Datei in `pages/` erstellen, 2) Import + Route in `App.tsx` eintragen, 3) Guard wählen.

---

## Neue Seite hinzufügen

```tsx
// App.tsx
import MeinePage from "@/pages/MeinePage";

// In Router():
<Route path="/meine-seite">
  <Protected><MeinePage /></Protected>
</Route>
```

---

## Route Guards (`App.tsx`)

```tsx
<Protected>      // Jeder eingeloggte User; leitet zu /sign-in wenn nicht eingeloggt
<AudiStaffOnly>  // role === 'audi_staff' || 'superuser'; zeigt "Access restricted" sonst
<SuperuserOnly>  // role === 'superuser'; zeigt "Access restricted" sonst
```

Rolle lesen:
```tsx
const { sessionClaims } = useAuth();
const role = (sessionClaims?.["publicMetadata"] as any)?.["role"];
const isSuperuser = role === "superuser";
const isStaff = role === "audi_staff" || isSuperuser;
```

---

## Dashboard-Navigation (Home.tsx → TopRightNav)

Die Navigation oben rechts ist rollenbasiert:

| Zustand | Anzeige |
|---------|---------|
| Nicht eingeloggt | "Log in" + "Register" |
| Eingeloggt (alle) | Role-Badge + "Dashboard"-Button + UserButton |

**Dashboard-Button routet je nach Rolle:**
- `superuser` → `/admin` (gold hervorgehoben)
- `audi_staff` → `/applications`
- Bewerber → `/dashboard`

---

## API-Calls (TanStack Query via `@workspace/api-client-react`)

```tsx
import { useListApplications, useGetApplication, useUpdateApplication } from "@workspace/api-client-react";

const { data: apps, isLoading } = useListApplications();
// GET /api/applications — Staff: alle; Bewerber: nur eigene (Backend filtert!)

const { data: app } = useGetApplication({ id });
// GET /api/applications/:id

const { mutateAsync: update } = useUpdateApplication();
// PATCH /api/applications/:id
```

**Auth-Header:** Clerk-JWT aus `useAuth().getToken()` wird per `custom-fetch.ts` automatisch gesetzt.

---

## PlantScene (`components/PlantScene.tsx`)

- **SVG isometrisch** mit `preserveAspectRatio="xMidYMid slice"` (füllt immer den gesamten Viewport)
- **Hit-Zones:** transparente Polygone über Gebäude → `onClick` → `setActiveDept(id)`
- **DeptCard:** `<foreignObject>` mit HTML-Popup → Button "Apply to X" → navigiert zu `/apply`
- **CalloutLabel:** Leader-Linien mit Pill-Labels nach außen (keine Überlappung mit Gebäuden)
- **MovingCar:** Audi-Sedans auf inneren Straßen (loopRed 18s, loopBlue 22s, dunkelrot/dunkelblau)
- **MovingF1Car:** Formel-1-Wagen auf dem äußeren F1_TRACK (28s, Audi-Rot `#BB0A21`)
- **Farbpalette:** Dunkel/Futuristisch — Hintergrund `#1A0D30→#0C0A1E→#0A0808`, Gebäude blau-violett/crimson/teal/navy
- **Audi-Logo:** `filter: brightness(0) invert(1)` → immer weiß

---

## Clerk-Integration

```tsx
// App.tsx
<ClerkProvider publishableKey={...} signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">

// SignIn.tsx / SignUp.tsx
<SignIn routing="hash" afterSignInUrl="/" />
// routing="hash" weil Clerk intern zu /sign-in/factor-one navigiert → Wildcard-Route nötig
// App.tsx: <Route path="/sign-in/:rest*" component={SignInPage} />
```

**Session-Claims nach Rollenänderung veraltet** → User muss sich aus- und einloggen.

---

## Audi-Design-System

| Token | Wert |
|-------|------|
| Audi-Rot | `#BB0A21` |
| Hintergrund Dark | `#0A0A14` |
| Hintergrund Hero | `radial-gradient(ellipse at 45% 45%, #1A0D30, #0C0A1E, #0A0808)` |
| Grid | `rgba(255,255,255,1)` 1px auf `#0A0A14`, opacity 2% |
| Font | Inter (Google Fonts CDN) |
| Radius | `rounded-sm` = 2px |
| Animationen | Framer Motion, ease `[0.22, 1, 0.36, 1]` |

**Framer-Motion `ease`-Tipp:** Immer als Tuple casten `as [number,number,number,number]` — sonst TypeScript-Fehler.

---

## Apply-Chatbot (`pages/Apply.tsx`)

```
State: messages[], collectedFields{}, isLoading, isSubmitting

1. User schreibt → POST /api/chat { messages, collectedFields }
   ← { reply: string, extractedFields: {} }
   → Felder mergen, FieldProgress-Bar aktualisieren

2. Optional: PDF hochladen → POST /api/extract-pdf
   ← { extracted: {}, found: [], missing: [] }
   → Bot bestätigt gefundene Felder

3. Wenn alle 7 Pflichtfelder gesammelt:
   → Submit-Button erscheint inline im Chat
   → POST /api/applications { companyName, transcript, ...felder }
   ← Application mit departmentScores
   → SuccessScreen: Tracking-Link + Top-3-Abteilungs-Matches
```

---

## Bewerber-Dashboard (`pages/Dashboard.tsx`)

- Nutzt `useListApplications()` — Backend gibt automatisch nur eigene zurück
- **Pipeline-Timeline:** Submitted → Analysis → Shortlisted → Accepted (rot gefüllt)
- **Stats-Strip:** Eingereicht / In Bearbeitung / Akzeptiert
- **Track-Link:** direkt zu `/track/:trackingToken`
- **Empty State:** Direkt zu `/apply`

---

## Staff-Dashboard (`pages/Applications.tsx`)

**ApplicationsList:** Stat-Karten → Filter-Tabs → Such-Input → Tabelle → Klick auf Zeile → Detail

**ApplicationDetail + StaffPanel** (nur für staff):
- Pipeline-Status Dropdown
- Rating (1–5 Sterne, anklickbar)
- Internal Notes (Textarea)
- Next Step (Text)
- Requirements (Checklist add/check/delete)
- Milestones (Titel + Datum + Status)
- KPIs (Metric / Target / Current / Unit)
- "Save All Changes" → PATCH /api/applications/:id

---

## Bekannte TS-Fehler (pre-existing, ignorieren)

- `Benefits.tsx`, `Testimonials.tsx`: `ease: number[]` nicht als Tuple → TS2322
- `PlantScene.tsx` Linie 81: `JSX.Element[]` in Windows-Funktion → TS2503
- `FocusAreas.tsx`: Framer-Motion `Variants` Typisierung → TS2322

Diese Fehler existierten vor unseren Änderungen und beeinflussen die Laufzeit nicht.
