# Deployment — Strato VPS (VC2-4, 4 GB RAM)

## Architektur

```
Internet
    │ :80 + :443
    ▼
┌─────────────────────────────────────────┐
│  nginx (Docker)                         │
│  ├── / → static React build (HTML/CSS/JS│
│  └── /api/ → proxy → api:8000           │
└────────────────────┬────────────────────┘
                     │ internal Docker network
                     ▼
              ┌─────────────┐
              │  api (Docker│
              │  Express    │
              │  port 8000  │
              └──────┬──────┘
                     │
            ┌────────┴────────┐
            │  Neon PostgreSQL │  ← extern
            │  Clerk Auth      │  ← extern
            └──────────────────┘
```

---

## Einmaliges VPS-Setup

### 1. Docker installieren

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Repo klonen

```bash
git clone https://github.com/Haydar120105/audi-innovation-hub.git
cd audi-innovation-hub
```

### 3. Env-Datei anlegen

```bash
cp .env.production.example .env.production
nano .env.production   # echte Keys eintragen
```

> **Wichtig:** Verwende in Produktion die Live-Keys von Clerk (`pk_live_...`, `sk_live_...`).  
> Den Test-Key (`pk_test_...`) nur für lokale Entwicklung.

### 4. DNS setzen

Gehe zu deinem DNS-Provider und setze einen **A-Record**:

```
hub.deinedomain.de   →   VPS-IP
```

Warte bis der Record propagiert ist (`ping hub.deinedomain.de` sollte die VPS-IP zurückgeben).

### 5. nginx.conf: Domain eintragen

```bash
sed -i 's/YOUR_DOMAIN/hub.deinedomain.de/g' docker/nginx.conf
```

### 6. Erstmalig: SSL-Zertifikat holen

Da das Zertifikat noch nicht existiert, kann nginx nicht mit HTTPS starten.  
Wir starten zuerst mit der HTTP-only Config, holen das Zertifikat, dann schalten wir auf HTTPS um:

```bash
# Schritt A: Mit HTTP-only Config starten
docker compose build
docker compose run -d --name nginx-init \
  -p 80:80 \
  -v $(pwd)/docker/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro \
  -v $(pwd)/certbot/www:/var/www/certbot:ro \
  $(docker compose config --images nginx 2>/dev/null || echo "audi-innovation-hub-nginx")

# Schritt B: Zertifikat holen
docker compose run --rm --profile certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d hub.deinedomain.de \
  --email deine@email.de \
  --agree-tos --no-eff-email

# Schritt C: Temporären nginx stoppen, echte Compose-Umgebung starten
docker stop nginx-init && docker rm nginx-init
docker compose up -d
```

### 7. Datenbank-Schema anwenden

Das Drizzle-Schema muss einmalig gegen die Neon-Datenbank gepusht werden.  
Das passiert am einfachsten **lokal** (nicht auf dem VPS):

```bash
# Lokal ausführen (DATABASE_URL aus .env.production oder artifacts/api-server/.env):
pnpm --filter @workspace/db run push
```

---

## Updates einspielen

```bash
cd ~/audi-innovation-hub
git pull
docker compose build
docker compose up -d
```

Für reine API-Updates (kein Frontend rebuild):
```bash
docker compose build api
docker compose up -d api
```

---

## SSL auto-renew (Crontab)

```bash
crontab -e
```

Folgende Zeile eintragen:

```cron
0 3 * * * cd /root/audi-innovation-hub && docker compose run --rm --profile certbot certbot renew --quiet && docker compose exec nginx nginx -s reload
```

Zertifikate laufen 90 Tage — Certbot erneuert sie automatisch wenn sie <30 Tage Restlaufzeit haben.

---

## Nützliche Befehle

```bash
# Status aller Container
docker compose ps

# Logs anzeigen
docker compose logs -f api
docker compose logs -f nginx

# API Health-Check
curl http://localhost:8000/api/healthz

# Container neustarten
docker compose restart api

# Alles stoppen
docker compose down

# Alles stoppen + Images löschen
docker compose down --rmi all
```

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| `api` startet nicht | `docker compose logs api` — wahrscheinlich fehlende Env-Var |
| nginx gibt 502 | API noch nicht `healthy` — kurz warten oder `docker compose logs api` |
| Clerk-Login schlägt fehl | `VITE_CLERK_PUBLISHABLE_KEY` stimmt nicht — Image neu bauen |
| Zertifikat-Fehler | DNS noch nicht propagiert — warten und erneut versuchen |
| Port 80/443 belegt | `ss -tlnp \| grep -E '80\|443'` — anderer Prozess blockiert |
