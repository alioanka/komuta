# TLS certificates (Let's Encrypt + Certbot)

HTTPS for Komuta is terminated by the `nginx` service and the certificates are
obtained/renewed by the `certbot` service. Both share two named Docker volumes
declared in `docker-compose.yml`:

| Volume          | Mounted at           | Purpose                                  |
| --------------- | -------------------- | ---------------------------------------- |
| `certbot-conf`  | `/etc/letsencrypt`   | Issued certs, keys, renewal config       |
| `certbot-www`   | `/var/www/certbot`   | HTTP-01 ACME challenge webroot           |

## One-time bootstrap

The first time you bring the stack up on a fresh server you have **no
certificate yet**, so nginx cannot start its `:443` block. The
`init-letsencrypt.sh` script solves the chicken-and-egg problem by issuing a
temporary self-signed cert, starting nginx, then requesting the real cert.

```bash
# 1. Point the domain's DNS A/AAAA record at this server.
# 2. Edit DOMAIN and EMAIL at the top of the script (or export them):
export DOMAIN=panora.live
export EMAIL=you@example.com

# 3. (optional) test against staging first to avoid rate limits:
export STAGING=1

# 4. Run from the repo root:
./infra/certbot/init-letsencrypt.sh
```

When it finishes, `https://$DOMAIN` should serve a valid certificate. Re-run
with `STAGING=0` (or unset) to get a trusted production cert.

> Make sure the domain in `infra/nginx/komuta.conf` matches `DOMAIN` — the
> `ssl_certificate` paths reference `/etc/letsencrypt/live/<domain>/`.

## Renewal

Renewal is automatic. The `certbot` service in `docker-compose.yml` runs
`certbot renew` every 12 hours; certbot only re-issues a cert when it is within
30 days of expiry. After a successful renewal, reload nginx to pick up the new
cert (run from the repo root):

```bash
docker compose exec nginx nginx -s reload
```

You can force a renewal check manually with:

```bash
docker compose run --rm certbot renew --dry-run
```
