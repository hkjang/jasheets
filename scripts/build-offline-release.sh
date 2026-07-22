#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=${1:-$(git -C "$ROOT_DIR" rev-parse --short HEAD)}
OUTPUT_DIR=${2:-$ROOT_DIR/dist/releases}
APP_IMAGE="jasheets/app:$VERSION"
BUNDLE_NAME="jasheets-offline-$VERSION"
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/jasheets-release.XXXXXX")
BUNDLE_DIR="$TEMP_DIR/$BUNDLE_NAME"

cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$OUTPUT_DIR" "$BUNDLE_DIR"

CONTEXT_TAR="$TEMP_DIR/source.tar"
git -C "$ROOT_DIR" archive --format=tar HEAD > "$CONTEXT_TAR"
docker build \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_WS_URL= \
  -f docker/Dockerfile.offline \
  -t "$APP_IMAGE" \
  - < "$CONTEXT_TAR"

cp "$ROOT_DIR/docker/docker-compose.offline.yml" "$BUNDLE_DIR/"
cp "$ROOT_DIR/docker/.env.offline.example" "$BUNDLE_DIR/"
cp "$ROOT_DIR/scripts/install-offline.sh" "$BUNDLE_DIR/install.sh"
cp "$ROOT_DIR/docs/OFFLINE_DEPLOYMENT.md" "$BUNDLE_DIR/DEPLOYMENT.md"
chmod 755 "$BUNDLE_DIR/install.sh"
sed -i "s/JASHEETS_VERSION=REPLACED_BY_RELEASE/JASHEETS_VERSION=$VERSION/" "$BUNDLE_DIR/.env.offline.example"

docker save -o "$BUNDLE_DIR/images.tar" \
  "$APP_IMAGE"
(
  cd "$BUNDLE_DIR"
  sha256sum images.tar > images.sha256
  printf '%s\n' \
    "version=$VERSION" \
    "commit=$(git -C "$ROOT_DIR" rev-parse HEAD)" \
    "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "images=$APP_IMAGE" \
    > release-manifest.txt
)

ARCHIVE="$OUTPUT_DIR/$BUNDLE_NAME.tar.gz"
tar -C "$TEMP_DIR" -czf "$ARCHIVE" "$BUNDLE_NAME"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
echo "$ARCHIVE"
echo "$ARCHIVE.sha256"
