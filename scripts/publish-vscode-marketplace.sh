#!/usr/bin/env bash
#
# Manually publish the VS Code extension to the Visual Studio Marketplace.
#
# This is separate from scripts/publish-vscode.sh, which publishes the npm
# package. The npm package is scoped as @ttsc/vscode, but Marketplace extensions
# cannot use scoped names. packages/vscode/build/build.cjs creates a VSIX whose
# manifest name is the unscoped "ttsc"; publish that generated VSIX instead of
# running `vsce publish` directly from packages/vscode.
#
# Usage:
#   VSCE_PAT=... bash scripts/publish-vscode-marketplace.sh
#   SKIP_BUILD=1 VSCE_PAT=... bash scripts/publish-vscode-marketplace.sh
#   DRY_RUN=1 bash scripts/publish-vscode-marketplace.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PKG_DIR="packages/vscode"
VERSION="$(node -p "require('./$PKG_DIR/package.json').version")"
VSIX="$REPO_ROOT/$PKG_DIR/dist/ttsc-vscode-$VERSION.vsix"

echo "==> Repo: $REPO_ROOT"
echo "==> Target: samchon.ttsc@$VERSION"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> Building Marketplace VSIX"
  pnpm --filter @ttsc/vscode build
else
  echo "==> SKIP_BUILD=1; reusing existing build artifacts"
fi

if [ ! -f "$VSIX" ]; then
  echo "!! $VSIX missing; build did not produce a .vsix" >&2
  exit 1
fi

echo "==> Asserting Marketplace VSIX and npm package layout"
node scripts/assert-vscode-package.cjs "$PKG_DIR"

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "==> DRY_RUN=1; not publishing"
  echo "==> Ready to publish: $VSIX"
  exit 0
fi

if [ -z "${VSCE_PAT:-}" ]; then
  echo "!! VSCE_PAT is required for Marketplace publish." >&2
  echo "!! Create a Marketplace PAT, then rerun with VSCE_PAT=..." >&2
  exit 1
fi

echo "==> Publishing $VSIX"
pnpm --dir "$PKG_DIR" exec vsce publish \
  --packagePath "$VSIX" \
  --no-dependencies \
  --skip-duplicate

echo "==> Done."
