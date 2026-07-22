#!/bin/sh
set -eu

if [ "${JASHEETS_SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "Applying JaSheets database migrations..."
  ./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma
fi

exec "$@"
