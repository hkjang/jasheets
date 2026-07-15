#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL_PREFIX="${TEST_DATABASE_URL_PREFIX:-postgresql://postgres:postgres@localhost:5432}"
ADMIN_URL="${DB_URL_PREFIX}/postgres"
FRESH_DB="jasheets_migration_fresh"
UPGRADE_DB="jasheets_migration_upgrade"
TEMP_PRISMA="$(mktemp -d)"

command -v psql >/dev/null || {
  echo "PostgreSQL client (psql) is required." >&2
  exit 1
}

cleanup() {
  rm -rf "${TEMP_PRISMA}"
  psql "${ADMIN_URL}" --set ON_ERROR_STOP=1 --quiet --command \
    "DROP DATABASE IF EXISTS ${FRESH_DB} WITH (FORCE);" >/dev/null
  psql "${ADMIN_URL}" --set ON_ERROR_STOP=1 --quiet --command \
    "DROP DATABASE IF EXISTS ${UPGRADE_DB} WITH (FORCE);" >/dev/null
}
trap cleanup EXIT

psql "${ADMIN_URL}" --set ON_ERROR_STOP=1 --quiet <<SQL
DROP DATABASE IF EXISTS ${FRESH_DB} WITH (FORCE);
DROP DATABASE IF EXISTS ${UPGRADE_DB} WITH (FORCE);
CREATE DATABASE ${FRESH_DB};
CREATE DATABASE ${UPGRADE_DB};
SQL

cd "${ROOT_DIR}"

echo "Verifying a fresh database migration and seed..."
DATABASE_URL="${DB_URL_PREFIX}/${FRESH_DB}" pnpm --filter api exec prisma migrate deploy
DATABASE_URL="${DB_URL_PREFIX}/${FRESH_DB}" pnpm --filter api exec prisma db seed
DATABASE_URL="${DB_URL_PREFIX}/${FRESH_DB}" pnpm --filter api exec prisma migrate status

echo "Verifying an upgrade from the previous migration..."
cp apps/api/prisma/schema.prisma "${TEMP_PRISMA}/schema.prisma"
cp -R apps/api/prisma/migrations "${TEMP_PRISMA}/migrations"
LATEST_MIGRATION="$(find "${TEMP_PRISMA}/migrations" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -n 1)"
if [[ -z "${LATEST_MIGRATION}" ]]; then
  echo "No migration directories were found." >&2
  exit 1
fi
rm -rf "${TEMP_PRISMA}/migrations/${LATEST_MIGRATION}"

DATABASE_URL="${DB_URL_PREFIX}/${UPGRADE_DB}" pnpm --filter api exec prisma migrate deploy --schema "${TEMP_PRISMA}/schema.prisma"
DATABASE_URL="${DB_URL_PREFIX}/${UPGRADE_DB}" pnpm --filter api exec prisma migrate deploy
DATABASE_URL="${DB_URL_PREFIX}/${UPGRADE_DB}" pnpm --filter api exec prisma migrate status

psql "${DB_URL_PREFIX}/${UPGRADE_DB}" --set ON_ERROR_STOP=1 --tuples-only --command \
  'SELECT 1 FROM "cell_mutations" LIMIT 0;'

echo "Fresh and upgraded database migrations are valid."
