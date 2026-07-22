#!/usr/bin/env bash
set -euo pipefail

readonly compose_file="docker/docker-compose.e2e.yml"
readonly database_url="postgresql://jasheets:jasheets_e2e_password@localhost:55432/jasheets_e2e?schema=public"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

cleanup() {
  docker compose -f "$compose_file" down --volumes
}
trap cleanup EXIT

docker compose -f "$compose_file" up -d --wait
DATABASE_URL="$database_url" pnpm --filter api exec prisma migrate deploy
if [[ "${JASHEETS_E2E_SKIP_BUILD:-0}" != "1" ]]; then
  pnpm --filter api build
fi
pnpm exec playwright test --config=playwright.real.config.ts "$@"
