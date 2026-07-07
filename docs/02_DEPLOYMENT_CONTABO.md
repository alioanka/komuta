# Production Deployment — Contabo VPS

This guide deploys Komuta to a **Contabo VPS** running **Ubuntu 22.04 or 24.04**, with
the whole stack (Postgres, Redis, api, worker, web) in **Docker Compose**, behind
**Nginx**. SSL/HTTPS is covered separately in
[`03_DOMAIN_AND_SSL.md`](./03_DOMAIN_AND_SSL.md).

Do these in order. Steps 1–3 (hardening) only need to be done once per server.

> **Conventions in this doc:**
> - `203.0.113.10` is a placeholder for **your VPS IPv4** — replace it everywhere.
> - `deploy` is the non-root user we create — use your own name if you prefer.
> - `panora.live` is a placeholder domain.

---

## 1. First login & server hardening

### 1.1 Log in as root (one time)

Contabo emails you the server IP and root password. First login:

```bash
ssh root@203.0.113.10
```

### 1.2 Update the system

```bash
apt update && apt -y upgrade
```

### 1.3 Create a sudo (non-root) user

Never run the app or log in as root day-to-day.

```bash
adduser deploy            # set a strong password when prompted
usermod -aG sudo deploy   # grant sudo
```

### 1.4 Set up SSH **key** login for `deploy`

**On your laptop** (not the server), create a key if you don't have one:

```bash
ssh-keygen -t ed25519 -C "komuta-deploy"   # press Enter for defaults
```

Copy your **public** key to the server:

```bash
ssh-copy-id deploy@203.0.113.10
# or, if ssh-copy-id is unavailable, paste the contents of ~/.ssh/id_ed25519.pub
# into /home/deploy/.ssh/authorized_keys on the server.
```

Test it — you should log in **without a password**:

```bash
ssh deploy@203.0.113.10
```

### 1.5 Disable root login and password authentication over SSH

> **Do this only after** confirming key login for `deploy` works, or you can lock
> yourself out.

Edit the SSH config:

```bash
sudo nano /etc/ssh/sshd_config
```

Set (or add) exactly these lines:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

On Ubuntu 22.04+, a drop-in file may override these. Check and fix:

```bash
sudo grep -R "PasswordAuthentication\|PermitRootLogin" /etc/ssh/sshd_config.d/ 2>/dev/null
# If a drop-in sets them to "yes", edit that file too.
```

Restart SSH:

```bash
sudo systemctl restart ssh
```

Open a **new** terminal and confirm you can still log in as `deploy` before closing the
old one.

### 1.6 Firewall (ufw): allow only SSH + HTTP + HTTPS

```bash
sudo apt -y install ufw
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (needed for Let's Encrypt + redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw --force enable
sudo ufw status verbose
```

> Postgres (5432) and Redis (6379) are **not** opened — they stay private inside the
> Docker network. Never expose them publicly.

### 1.7 fail2ban (block brute-force SSH)

```bash
sudo apt -y install fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

### 1.8 Automatic security updates

```bash
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # choose "Yes"
```

---

## 2. Install Docker + Compose plugin

Use Docker's official convenience script:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Let `deploy` run Docker without `sudo`:

```bash
sudo usermod -aG docker deploy
# Log out and back in for the group change to take effect:
exit
ssh deploy@203.0.113.10
```

Verify (the Compose **plugin** is included by the script):

```bash
docker --version
docker compose version
```

---

## 3. Clone the repository & configure `.env`

```bash
# pick a stable location
cd /opt
sudo mkdir -p komuta && sudo chown deploy:deploy komuta
git clone https://github.com/alioanka/komuta.git komuta
cd komuta
```

Create the production `.env` from the template:

```bash
cp .env.example .env
nano .env
```

Fill in **production** values. Reference [`.env.example`](../.env.example) for the full
list — the most important production changes:

| Variable                        | Production value                                              |
|---------------------------------|--------------------------------------------------------------|
| `NODE_ENV`                      | `production`                                                  |
| `APP_URL`                       | `https://panora.live`                                         |
| `API_URL`                       | `https://panora.live/api`                                     |
| `NEXT_PUBLIC_API_URL`           | `https://panora.live/api` — **inlined into the web bundle at build time**; changing it requires `docker compose build web` again |
| `CORS_ORIGIN`                   | `https://panora.live`                                        |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | strong password; must match `DATABASE_URL` |
| `COOKIE_DOMAIN`                 | `.panora.live`                                                |
| `DATABASE_URL`                  | point host at the compose service, e.g. `...@postgres:5432/...` |
| `REDIS_URL`                     | `redis://redis:6379`                                         |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -base64 48` each                    |
| `META_*`, `WHATSAPP_*`          | from [`04_META_WHATSAPP_SETUP.md`](./04_META_WHATSAPP_SETUP.md) |
| `TELEGRAM_*`                    | from [`06_TELEGRAM_ALERTS.md`](./06_TELEGRAM_ALERTS.md)      |
| `BACKUP_ENCRYPTION_KEY`         | `openssl rand -base64 32`                                    |
| `SEED_OWNER_*`, `SEED_ACCOUNTANT_*` | set, then **change the passwords after first login**    |

> Inside Docker Compose, services reach each other by **service name**, not
> `localhost`. So `DATABASE_URL` host = `postgres`, `REDIS_URL` host = `redis`.

Lock down the file so secrets aren't world-readable:

```bash
chmod 600 .env
```

---

## 4. Build and start the stack

```bash
docker compose up -d --build
```

This builds the api/worker/web images and starts every service (postgres, redis, api,
worker, web, and the nginx/certbot containers if defined in the compose file). Check
status:

```bash
docker compose ps
```

---

## 5. Run database migrations & seed (first deploy only)

Apply migrations **inside the running api container** (note: `db:deploy` uses
`prisma migrate deploy`, the non-interactive production command):

```bash
docker compose exec api pnpm db:deploy
```

Seed the initial companies/outlets/users **once**:

```bash
docker compose exec api pnpm db:seed
```

> On subsequent updates, run `db:deploy` (migrations) but **do not** re-seed.

---

## 6. Nginx reverse proxy

Nginx terminates HTTP/HTTPS and routes paths to the right container. The config lives in
`infra/nginx/` and is mounted into the nginx container by the compose file. The routing
you want:

| Public path     | Proxied to        | Purpose                                  |
|-----------------|-------------------|------------------------------------------|
| `/`             | `web:3000`        | Next.js dashboards                       |
| `/api`          | `api:4000`        | REST API + SSE                           |
| `/webhooks`     | `api:4000`        | WhatsApp webhook                         |

A minimal HTTP server block (HTTPS is added in doc 03) looks like:

```nginx
server {
    listen 80;
    server_name panora.live www.panora.live;

    # Let's Encrypt HTTP-01 challenge (see doc 03)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /api/ {
        proxy_pass http://api:4000/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhooks/ {
        proxy_pass http://api:4000/webhooks/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://web:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;     # SSE / websockets
        proxy_set_header Connection        "upgrade";
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;                                  # important for SSE
    }
}
```

> **SSE note:** the SSE endpoint (live dashboard updates) needs `proxy_buffering off;`
> and a long/`proxy_read_timeout`. Keep buffering off on any location that proxies SSE.

Reload Nginx after editing config:

```bash
docker compose exec nginx nginx -t      # test config
docker compose exec nginx nginx -s reload
```

Now continue to [`03_DOMAIN_AND_SSL.md`](./03_DOMAIN_AND_SSL.md) to point your domain at
this server and switch to HTTPS.

---

## 7. Health checks

```bash
# API health (through Nginx once DNS/HTTPS are set)
curl -I http://203.0.113.10/api/health     # before DNS
curl -I https://panora.live/api/health      # after doc 03

# Containers
docker compose ps
```

A healthy deployment shows all containers `Up`/`healthy` and the health endpoint
returning `200`.

---

## 8. Logs, restart, and the update flow

### View logs

```bash
docker compose logs -f                 # everything, follow
docker compose logs -f api             # just the API
docker compose logs -f worker          # just the worker
docker compose logs --tail=200 web     # last 200 lines of web
```

### Restart

```bash
docker compose restart api worker      # restart specific services
docker compose restart                 # restart all
```

### Update flow (deploy a new version)

```bash
cd /opt/komuta
git pull
docker compose up -d --build           # rebuild changed images
docker compose exec api pnpm db:deploy # apply any new migrations
docker compose logs -f api worker      # watch it come up
```

> **Use the deploy script.** The repeatable update flow above is wrapped in
> `infra/scripts/deploy.sh`. Run it from the repo root on the VPS:
>
> ```bash
> ./infra/scripts/deploy.sh
> ```
>
> It performs `git pull` → `docker compose up -d --build` → `db:deploy` and tails logs.
> Read the script before first use so you know exactly what it does on your server.

---

## 9. Quick recovery cheatsheet

| Situation                          | Command                                                       |
|------------------------------------|---------------------------------------------------------------|
| Restart everything                 | `docker compose restart`                                      |
| Full rebuild after code change     | `docker compose up -d --build`                                |
| See why a container is unhealthy   | `docker compose logs --tail=200 <service>`                    |
| Stop the stack                     | `docker compose down` (data persists in volumes)              |
| Apply new DB migrations            | `docker compose exec api pnpm db:deploy`                       |
| Enter a container shell            | `docker compose exec api sh`                                  |

See [`08_OPERATIONS_RUNBOOK.md`](./08_OPERATIONS_RUNBOOK.md) for deeper day-2 ops and
[`09_BACKUP_RESTORE.md`](./09_BACKUP_RESTORE.md) for backups.
