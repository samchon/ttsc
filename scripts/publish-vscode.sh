#!/usr/bin/env bash
#
# Manually publish @ttsc/vscode to npm.
#
# Use this when the regular release.yml run didn't ship @ttsc/vscode (e.g. an
# earlier package in the chain failed, or the package was added after the tag
# was cut). The package's npm tarball ships a pre-built .vsix plus a
# `ttsc-vscode` bin shim that runs `code --install-extension`, so once it's on
# the registry users can do:
#
#   npm i -g @ttsc/vscode
#   ttsc-vscode install
#
# The marketplace is NOT involved — this is npm-only distribution.
#
# Usage:
#   bash scripts/publish-vscode.sh                   # build + publish
#   SKIP_BUILD=1 bash scripts/publish-vscode.sh      # reuse current build
#   DRY_RUN=1 bash scripts/publish-vscode.sh         # pnpm pack only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PKG_DIR="packages/vscode"
VERSION="$(node -p "require('./$PKG_DIR/package.json').version")"

echo "==> Repo: $REPO_ROOT"
echo "==> Target: @ttsc/vscode@$VERSION"

# Sanity: must be logged in to npm.
if ! npm whoami >/dev/null 2>&1; then
  echo "!! Not logged in to npm. Run: npm login" >&2
  exit 1
fi
echo "==> npm whoami: $(npm whoami)"

# Skip if this version is already on the registry. `npm view` exits non-zero
# on 404 (first publish), so swallow it with `|| true` and let the node parser
# default to "no" on empty input.
already="$(
  (npm view "@ttsc/vscode" "versions" --json 2>/dev/null || true) \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s||"[]");process.stdout.write((Array.isArray(v)?v:[v]).includes(process.argv[1])?"yes":"no")}catch{process.stdout.write("no")}})' "$VERSION"
)"
if [ "$already" = "yes" ]; then
  echo "==> @ttsc/vscode@$VERSION already on npm. Nothing to do."
  exit 0
fi

# Build (esbuild bundle + vsce package).
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> Building @ttsc/vscode"
  pnpm --filter @ttsc/vscode build
else
  echo "==> SKIP_BUILD=1; reusing existing build artifacts"
fi

VSIX="$PKG_DIR/dist/ttsc-vscode-$VERSION.vsix"
if [ ! -f "$VSIX" ]; then
  echo "!! $VSIX missing — build did not produce a .vsix" >&2
  exit 1
fi
echo "==> $VSIX ok ($(stat -c%s "$VSIX") bytes)"

# Dry-run: pnpm pack to /tmp instead of publishing. pnpm 10.x's pack/publish
# don't accept --dir for these subcommands (they fall through to npm), so we
# cd into the package directory.
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "==> DRY_RUN=1; packing only (no publish)"
  (cd "$PKG_DIR" && pnpm pack --pack-destination /tmp)
  echo "==> /tmp/ttsc-vscode-$VERSION.tgz contents:"
  tar -tzf "/tmp/ttsc-vscode-$VERSION.tgz"
  exit 0
fi

# Local publish skips --provenance (needs GitHub Actions OIDC).
echo "==> Publishing @ttsc/vscode@$VERSION"
(cd "$PKG_DIR" && pnpm publish --tag latest --access public --no-git-checks)

echo "==> Done. Verifying:"
npm view "@ttsc/vscode" version
