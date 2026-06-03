# Deployment — Coolify (Docker Compose)

Die Plattform wird über **Coolify** deployed — eine selbst-gehostete PaaS, die das
`docker-compose.yml` direkt aus dem Git-Repo baut und betreibt. Coolify bringt einen
eigenen Reverse-Proxy (**Traefik**) inkl. automatischem **Let's-Encrypt-SSL** mit —
deshalb gibt es im Repo keine Certbot-/manuelle-SSL-Logik mehr.

## Architektur

```
Domain (DNS A-Record)
    │ :443 (HTTPS)
    ▼
┌──────────────────────────────────┐
│  Coolify Traefik-Proxy           │  ← SSL-Terminierung (Let's Encrypt, automatisch)
└────────────────┬─────────────────┘
                 │ :80 (HTTP, intern)
                 ▼
┌──────────────────────────────────┐
│  nginx (Docker)                  │
│  ├── /     → static React build  │
│  └── /api/ → proxy → api:8000     │
└────────────────┬─────────────────┘
                 │ internes Docker-Netzwerk
                 ▼
          ┌─────────────┐
          │  api (Docker)│  Express, Port 8000
          └──────┬───────┘
                 │
        ┌────────┴─────────┐
        │  Neon PostgreSQL  │  ← extern
        │  Clerk Auth       │  ← extern
        │  Anthropic API    │  ← extern
        └───────────────────┘
```

Services (siehe `docker-compose.yml`):
- **api** — Express-Server, exposed intern Port 8000, Healthcheck auf `/api/healthz`.
- **nginx** — serviert das statische React-Build und proxyt `/api/` → `api:8000`,
  exposed intern Port 80. Coolify routet die Domain hierher.

---

## Einmaliges Setup in Coolify

### 1. Coolify auf dem Server installieren (falls noch nicht vorhanden)

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Coolify-UI öffnen (`http://SERVER-IP:8000`) und Admin-Account anlegen.

### 2. Ressource anlegen

1. **Project → New Resource → Docker Compose** (Git-basiert).
2. Git-Repo verbinden (`https://github.com/Haydar120105/audi-innovation-hub.git`),
   Branch wählen. Coolify erkennt das `docker-compose.yml` automatisch.

### 3. Environment-Variablen setzen

In der Coolify-UI unter **Environment Variables** eintragen (NICHT ins Repo committen):

| Variable | Wert | Hinweis |
|----------|------|---------|
| `DATABASE_URL` | `postgresql://...` | Neon-Connection-String |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Publishable (Live) |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk Secret (Live) — nur Backend |
| `DEPARTMENT_WRITE_SECRET` | beliebiger starker String | Legacy Department-Endpoints |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` (= `CLERK_PUBLISHABLE_KEY`) | **als Build-Variable markieren** |

> **Wichtig:** `VITE_CLERK_PUBLISHABLE_KEY` wird zur **Build-Zeit** ins JS-Bundle
> gebacken. In Coolify muss die Variable als **Build Variable / Build-Time** markiert
> sein, sonst landet sie nicht im Frontend.

### 4. Domain + SSL

1. DNS **A-Record** auf die Coolify-Server-IP setzen (`hub.deinedomain.de → SERVER-IP`).
2. In Coolify die Domain dem **`nginx`-Service (Port 80)** zuweisen.
3. Coolify holt automatisch ein Let's-Encrypt-Zertifikat und terminiert HTTPS via Traefik —
   keine manuelle Certbot-Konfiguration nötig.

### 5. Clerk Production-Instanz

Live-Keys (`pk_live_...`) erfordern eine in Clerk hinterlegte, verifizierte Domain.
Im [Clerk-Dashboard](https://dashboard.clerk.com) die Produktions-Domain eintragen.

### 6. Datenbank-Schema anwenden (einmalig)

Das Drizzle-Schema muss einmalig gegen die Neon-Datenbank gepusht werden — am
einfachsten **lokal** (nicht auf dem Server):

```bash
# DATABASE_URL der Produktions-DB exportieren oder in artifacts/api-server/.env setzen
pnpm --filter @workspace/db run push
```

### 7. Deploy auslösen

In Coolify auf **Deploy** klicken. Coolify baut beide Images (`api` + `nginx`) und
startet die Services. Folge-Deploys laufen automatisch bei `git push` (wenn Auto-Deploy
aktiviert ist) oder per Klick.

---

## Lokaler Build-Test (vor dem Push empfohlen)

Prüfen, dass beide Images sauber bauen:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... docker compose build
```

Komplett lokal hochfahren (mit einer `.env.production`-Datei für die Runtime-Vars):

```bash
docker compose --env-file .env.production up -d
docker compose ps
curl http://localhost:8000/api/healthz   # → 200
```

> Hinweis: Lokal mappt Compose keine Host-Ports (nur `expose`). Für einen lokalen
> Browser-Test ggf. temporär ein `ports: ["8080:80"]` zum `nginx`-Service ergänzen.

---

## Lokale Entwicklung (ohne Docker)

```bash
# Terminal 1 — Backend
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/audi-innovation-hub run dev
```

Frontend → http://localhost:5173 | Backend → http://localhost:8000
Vite proxyt `/api/*` → `localhost:8000`.

---

## Nützliche Befehle (Server / lokal)

```bash
docker compose ps                  # Status aller Container
docker compose logs -f api         # API-Logs
docker compose logs -f nginx       # nginx-Logs
curl http://localhost:8000/api/healthz   # Health-Check
docker compose restart api         # Container neustarten
docker compose down                # Alles stoppen
```

In Coolify selbst gibt es Logs, Deploy-History, Rollback und Env-Management direkt in der UI.

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| `api` startet nicht | Logs prüfen — meist fehlende Env-Var in Coolify |
| nginx gibt 502 | API noch nicht `healthy` — kurz warten oder API-Logs prüfen |
| Clerk-Login schlägt fehl | `VITE_CLERK_PUBLISHABLE_KEY` fehlt/falsch — als **Build-Variable** setzen und neu deployen |
| SSL-Zertifikat kommt nicht | DNS A-Record noch nicht propagiert — warten, dann in Coolify neu auslösen |
| `pnpm frozen-lockfile` Fehler | `pnpm-lock.yaml` ist veraltet — lokal `pnpm install` ausführen und committen |
| `tsconfig.base.json` nicht gefunden | In `docker/*.Dockerfile` sicherstellen, dass `tsconfig.base.json`/`tsconfig.json` mitkopiert werden |
| `VITE_CLERK_PUBLISHABLE_KEY not set` Warning beim Runtime-Start | Harmlos — der Key wurde bereits beim Build eingebettet |
