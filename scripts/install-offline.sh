#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Engine 24+ and Docker Compose v2 are required." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.offline.example .env
  echo "Created $SCRIPT_DIR/.env"
  echo "Set POSTGRES_DSN, then run this script again." >&2
  exit 2
fi

if grep -Eq 'CHANGE_(ME|TO_)' .env; then
  echo "Refusing to deploy placeholder secrets. Update $SCRIPT_DIR/.env first." >&2
  exit 2
fi

sha256sum -c images.sha256
docker load -i images.tar
docker compose --env-file .env -f docker-compose.offline.yml config >/dev/null
docker compose --env-file .env -f docker-compose.offline.yml up -d
docker compose --env-file .env -f docker-compose.offline.yml ps

echo "JaSheets is starting. Route Ingress / to port 3000 and /api,/socket.io to port 4000."
