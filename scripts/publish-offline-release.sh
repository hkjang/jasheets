#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=${1:-v$(node -p "require('$ROOT_DIR/package.json').version")}
TAG="$VERSION"
OUTPUT_DIR="$ROOT_DIR/dist/releases"
ARCHIVE="$OUTPUT_DIR/jasheets-offline-$VERSION.tar.gz"

"$ROOT_DIR/scripts/build-offline-release.sh" "$VERSION" "$OUTPUT_DIR"

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists. Bump the project patch version instead of replacing it." >&2
  exit 3
fi

gh release create "$TAG" "$ARCHIVE" "$ARCHIVE.sha256" \
  --target "$(git -C "$ROOT_DIR" rev-parse HEAD)" \
  --title "JaSheets $VERSION" \
  --notes "Air-gapped Docker bundle for commit $(git -C "$ROOT_DIR" rev-parse --short HEAD). See DEPLOYMENT.md inside the archive."
