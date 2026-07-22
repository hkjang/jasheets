#!/bin/sh
set -eu

: "${POSTGRES_DSN:?POSTGRES_DSN must be set}"
export DATABASE_URL="$POSTGRES_DSN"

STATE_DIR=${JASHEETS_STATE_DIR:-/var/lib/jasheets}
mkdir -p "$STATE_DIR"

generate_secret() {
  target=$1
  if [ ! -s "$target" ]; then
    umask 077
    head -c 48 /dev/urandom | base64 > "$target"
  fi
}

generate_secret "$STATE_DIR/jwt-secret"
generate_secret "$STATE_DIR/oidc-encryption-key"
export JWT_SECRET=$(cat "$STATE_DIR/jwt-secret")
export OIDC_CONFIG_ENCRYPTION_KEY=$(cat "$STATE_DIR/oidc-encryption-key")
export CORS_ORIGIN=${CORS_ORIGIN:-*}

echo "Applying JaSheets database migrations..."
cd /app/api
migration_attempt=1
until ./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma; do
  if [ "$migration_attempt" -ge 30 ]; then
    echo "Database did not become ready after $migration_attempt attempts." >&2
    exit 1
  fi
  echo "Database is not ready; retrying migration in 2 seconds ($migration_attempt/30)..." >&2
  migration_attempt=$((migration_attempt + 1))
  sleep 2
done

shutdown() {
  kill -TERM "${API_PID:-0}" "${WEB_PID:-0}" 2>/dev/null || true
  wait "${API_PID:-0}" "${WEB_PID:-0}" 2>/dev/null || true
}
trap shutdown INT TERM EXIT

API_PORT=4000 PORT=4000 node /app/api/dist/main.js &
API_PID=$!
PORT=3000 HOSTNAME=0.0.0.0 node /app/web/apps/web/server.js &
WEB_PID=$!

while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 2
done

exit 1
