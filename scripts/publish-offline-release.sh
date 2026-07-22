#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=${1:-$(git -C "$ROOT_DIR" rev-parse --short HEAD)}
TAG="offline-$VERSION"
OUTPUT_DIR="$ROOT_DIR/dist/releases"
ARCHIVE="$OUTPUT_DIR/jasheets-offline-$VERSION.tar.gz"

"$ROOT_DIR/scripts/build-offline-release.sh" "$VERSION" "$OUTPUT_DIR"

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$ARCHIVE" "$ARCHIVE.sha256" --clobber
else
  gh release create "$TAG" "$ARCHIVE" "$ARCHIVE.sha256" \
    --target "$(git -C "$ROOT_DIR" rev-parse HEAD)" \
    --title "JaSheets Offline $VERSION" \
    --notes "Air-gapped Docker bundle for commit $(git -C "$ROOT_DIR" rev-parse --short HEAD). See DEPLOYMENT.md inside the archive."
fi
