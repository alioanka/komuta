#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Komuta — Let's Encrypt bootstrap.
#
# Run ONCE on the VPS (from the repo root) before the very first HTTPS start.
# It:
#   1. downloads recommended TLS params,
#   2. creates a throwaway "dummy" self-signed cert so nginx can boot,
#   3. starts nginx,
#   4. deletes the dummy and requests the REAL cert via the certbot container,
#   5. reloads nginx with the real cert.
#
# Adapted from the canonical wmnnd/nginx-certbot bootstrap script.
#
# Usage:
#   1. Point your domain's A/AAAA records at this server first.
#   2. Edit DOMAIN and EMAIL below (or pass them in as env vars).
#   3. ./infra/certbot/init-letsencrypt.sh
# ----------------------------------------------------------------------------
set -euo pipefail

# ----- EDIT THESE (or export before running) --------------------------------
DOMAIN="${DOMAIN:-komuta.example.com}"   # <-- REPLACE with your domain
EMAIL="${EMAIL:-admin@example.com}"      # <-- REPLACE with your email (renewal notices)
# Set STAGING=1 to hit Let's Encrypt staging while testing (avoids rate limits).
STAGING="${STAGING:-0}"
# ----------------------------------------------------------------------------

# Compose command + the volumes used by nginx/certbot in docker-compose.yml.
COMPOSE="docker compose"
RSA_KEY_SIZE=4096
DATA_PATH="./infra/certbot/data"        # local mirror used only for the dummy cert
CONF_VOLUME="komuta_certbot-conf"       # named volume mounted at /etc/letsencrypt

cd "$(dirname "$0")/../.." # repo root

if [ "$DOMAIN" = "komuta.example.com" ] || [ "$EMAIL" = "admin@example.com" ]; then
  echo "ERROR: edit DOMAIN and EMAIL at the top of this script first." >&2
  exit 1
fi

echo "### Downloading recommended TLS parameters ..."
$COMPOSE run --rm --entrypoint "\
  sh -c 'mkdir -p /etc/letsencrypt && \
  wget -qO /etc/letsencrypt/options-ssl-nginx.conf https://raw.githubusercontent.com/certbot/certbot/main/certbot-nginx/src/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf && \
  wget -qO /etc/letsencrypt/ssl-dhparams.pem https://raw.githubusercontent.com/certbot/certbot/main/certbot/certbot/ssl-dhparams.pem'" certbot || true

echo "### Creating dummy certificate for $DOMAIN ..."
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
$COMPOSE run --rm --entrypoint "\
  sh -c 'mkdir -p $CERT_PATH && \
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout $CERT_PATH/privkey.pem \
    -out $CERT_PATH/fullchain.pem \
    -subj /CN=localhost'" certbot

echo "### Starting nginx ..."
$COMPOSE up --force-recreate -d nginx

echo "### Deleting dummy certificate for $DOMAIN ..."
$COMPOSE run --rm --entrypoint "\
  sh -c 'rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf'" certbot

echo "### Requesting Let's Encrypt certificate for $DOMAIN ..."
STAGING_ARG=""
if [ "$STAGING" != "0" ]; then
  STAGING_ARG="--staging"
fi

$COMPOSE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    -d $DOMAIN \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

echo "### Reloading nginx ..."
$COMPOSE exec nginx nginx -s reload

echo "### Done. HTTPS should now be live for https://$DOMAIN"
