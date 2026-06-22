#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Komuta — external health check.
#
# Curls the api /health endpoint and the web app. Exits non-zero if either is
# unreachable, so it can drive cron alerts / uptime monitors.
#
# Override the targets via env vars (defaults assume the public site):
#   API_HEALTH_URL  (default https://komuta.example.com/api/health)
#   WEB_URL         (default https://komuta.example.com/)
#
# Usage:
#   ./infra/scripts/healthcheck.sh
#   API_HEALTH_URL=http://localhost:4000/health WEB_URL=http://localhost:3000/ ./infra/scripts/healthcheck.sh
# ----------------------------------------------------------------------------
set -euo pipefail

# <-- REPLACE komuta.example.com with your domain, or pass URLs via env.
API_HEALTH_URL="${API_HEALTH_URL:-https://komuta.example.com/api/health}"
WEB_URL="${WEB_URL:-https://komuta.example.com/}"
TIMEOUT="${HEALTHCHECK_TIMEOUT:-10}"

FAILED=0

check() {
  local name="$1" url="$2"
  local code
  # -f: fail on HTTP >= 400; capture status code for the log line.
  if code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$url")"; then
    echo "OK   $name ($url) -> $code"
  else
    echo "FAIL $name ($url) unreachable or returned an error" >&2
    FAILED=1
  fi
}

check "api"  "$API_HEALTH_URL"
check "web"  "$WEB_URL"

if [ "$FAILED" -ne 0 ]; then
  echo "==> Health check FAILED" >&2
  exit 1
fi

echo "==> All healthy"
