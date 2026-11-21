#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# AskChokro WordPress Plugin Release Packager
#
# Builds production assets and produces a clean askchokro.zip ready for
# WordPress.org Plugin Directory submission or manual upload.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WP_DIR="$ROOT_DIR/packages/wordpress-plugin"
DIST_DIR="$ROOT_DIR/dist/wordpress"
STAGE_DIR="$DIST_DIR/askchokro"

export PATH="/usr/local/lib/node_modules/corepack/shims:$HOME/bin:/usr/local/bin:$PATH"

echo "==> Building WordPress plugin production assets..."
cd "$WP_DIR"
pnpm run build

echo "==> Preparing clean packaging directory at $STAGE_DIR..."
rm -rf "$DIST_DIR"
mkdir -p "$STAGE_DIR"

# Copy distribution files conforming to WordPress.org directory rules
cp -f "$WP_DIR/askchokro.php" "$STAGE_DIR/"
cp -f "$WP_DIR/readme.txt" "$STAGE_DIR/"
cp -f "$WP_DIR/LICENSE" "$STAGE_DIR/"

cp -r "$WP_DIR/includes" "$STAGE_DIR/"
cp -r "$WP_DIR/build" "$STAGE_DIR/"
cp -r "$WP_DIR/assets" "$STAGE_DIR/"

# Remove dev/temp files if any slipped in
find "$STAGE_DIR" -type f -name ".DS_Store" -delete
find "$STAGE_DIR" -type f -name "*~" -delete

echo "==> Creating release archive: $DIST_DIR/askchokro.zip..."
cd "$DIST_DIR"
zip -r -q "askchokro.zip" "askchokro"

echo "==> Release archive ready at: $DIST_DIR/askchokro.zip"
unzip -l "$DIST_DIR/askchokro.zip"
