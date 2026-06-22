# Domain & SSL (HTTPS)

This guide buys/points a domain at your Contabo VPS and gives Komuta a free, auto-renewing
**Let's Encrypt** TLS certificate via a dockerized **Certbot**. HTTPS is **mandatory** —
Meta's WhatsApp Cloud API will only deliver webhooks to an HTTPS URL.

Prerequisite: the stack from [`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md) is
running, and ports 80/443 are open in `ufw`.

> Placeholders: `komuta.app` = your domain; `203.0.113.10` = your VPS IPv4;
> `2001:db8::1` = your VPS IPv6 (optional).

---

## 1. Register a domain

Use any registrar (Namecheap, Cloudflare Registrar, Porkbun, GoDaddy, Gandi, etc.).
Suggested names for this project:

- `komuta.app`
- `komutapanel.com`

> `.app` domains are on the HSTS preload list and **require HTTPS** — which is fine,
> because we use HTTPS anyway.

After purchase, find the registrar's **DNS management** page.

---

## 2. Create DNS records

Find your VPS IP addresses on the server:

```bash
curl -4 ifconfig.co     # IPv4
curl -6 ifconfig.co     # IPv6 (if your VPS has one)
```

Create these records at your registrar:

| Type   | Host / Name | Value                | Purpose                          |
|--------|-------------|----------------------|----------------------------------|
| `A`    | `@`         | `203.0.113.10`       | Root domain → VPS (IPv4)         |
| `A`    | `www`       | `203.0.113.10`       | `www.` subdomain (IPv4)          |
| `A`    | `panel`     | `203.0.113.10`       | Optional `panel.` subdomain      |
| `AAAA` | `@`         | `2001:db8::1`        | Root domain → VPS (IPv6) — only if you have IPv6 |
| `AAAA` | `www`       | `2001:db8::1`        | IPv6 for `www`                   |

> If you don't have IPv6 on the VPS, **omit the AAAA records entirely** — a dangling
> AAAA record will break access for IPv6 clients.

### Propagation

DNS changes take time to spread (TTL-dependent; usually minutes, sometimes up to a few
hours). Verify with:

```bash
dig +short komuta.app A
dig +short www.komuta.app A
# Both should return 203.0.113.10
```

Don't request a certificate until `dig` returns the correct IP — Let's Encrypt validates
by reaching your server over the domain.

---

## 3. Obtain the Let's Encrypt certificate (dockerized Certbot)

Komuta uses an Nginx + Certbot pattern. Nginx serves the ACME HTTP-01 challenge from
`/.well-known/acme-challenge/` (mounted to `/var/www/certbot`), and Certbot writes certs
into a shared volume that Nginx reads.

### 3.1 Make sure Nginx serves the challenge path

The HTTP server block from doc 02 already includes:

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

Reload Nginx:

```bash
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
```

### 3.2 Issue the certificate (initial issuance)

Run a one-shot Certbot container against the shared webroot. Replace the domain and your
email (used for expiry notices):

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d komuta.app -d www.komuta.app \
  --email aoankarali@gmail.com \
  --agree-tos --no-eff-email
```

> If your compose file names the certbot service differently, use that name. The flags
> are the important part: `certonly --webroot -w /var/www/certbot -d <domains>`.

On success, certs land in `/etc/letsencrypt/live/komuta.app/` (inside the shared
volume): `fullchain.pem` and `privkey.pem`.

---

## 4. Enable HTTPS in Nginx (with redirect + HSTS)

Replace/extend the server block from doc 02 so HTTP redirects to HTTPS and HTTPS serves
the app:

```nginx
# --- HTTP: serve ACME challenge, redirect everything else to HTTPS ---
server {
    listen 80;
    server_name komuta.app www.komuta.app;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# --- HTTPS: the real site ---
server {
    listen 443 ssl;
    http2 on;
    server_name komuta.app www.komuta.app;

    ssl_certificate     /etc/letsencrypt/live/komuta.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/komuta.app/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # HSTS: force HTTPS for 1 year (only enable once HTTPS is confirmed working)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

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
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;     # SSE
    }
}
```

Reload Nginx:

```bash
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
```

---

## 5. Auto-renewal

Let's Encrypt certs last **90 days**. Set renewal to run automatically. Two common
patterns — use whichever your compose/systemd setup follows:

### Option A — long-running Certbot container (in compose)

A `certbot` service that loops:

```yaml
# excerpt — typically already in your compose file
certbot:
  image: certbot/certbot
  entrypoint: >
    /bin/sh -c 'trap exit TERM;
    while :; do certbot renew --webroot -w /var/www/certbot --quiet;
    sleep 12h & wait $${!}; done'
  volumes:
    - certbot-conf:/etc/letsencrypt
    - certbot-www:/var/www/certbot
```

Nginx must reload to pick up renewed certs. A simple approach is to reload Nginx on a
timer too, or add `--deploy-hook` to the renew command.

### Option B — host cron / systemd timer

If renewal runs from the host, add a cron entry (`sudo crontab -e`):

```cron
# Attempt renewal twice daily; reload nginx if a cert was renewed
0 3,15 * * * cd /opt/komuta && docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet && docker compose exec -T nginx nginx -s reload
```

Test renewal without actually renewing:

```bash
docker compose run --rm certbot renew --dry-run
```

A successful dry run means auto-renewal will work.

---

## 6. Verify HTTPS

```bash
curl -I https://komuta.app
# Look for: HTTP/2 200, and a "strict-transport-security" header.

curl -I http://komuta.app
# Look for: HTTP/1.1 301 Moved Permanently → location: https://komuta.app/

curl -I https://komuta.app/api/health
# Look for: HTTP/2 200
```

You can also check the certificate grade at <https://www.ssllabs.com/ssltest/>.

> Once HTTPS is verified, the WhatsApp webhook callback URL is
> `https://komuta.app/webhooks/whatsapp` — use it in
> [`04_META_WHATSAPP_SETUP.md`](./04_META_WHATSAPP_SETUP.md).
