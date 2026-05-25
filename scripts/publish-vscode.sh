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

if [ "${DRY_RUN:-0}" != "1" ]; then
  # Sanity: must be logged in to npm for an actual publish. Dry-run packaging
  # stays usable without credentials so release artifact checks work locally.
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
VSIX_SIZE="$(node -e "process.stdout.write(String(require('node:fs').statSync(process.argv[1]).size))" "$VSIX")"
echo "==> $VSIX ok ($VSIX_SIZE bytes)"

PACK_DIR="$(mktemp -d)"
echo "==> Packing @ttsc/vscode for artifact assertions"
(cd "$PKG_DIR" && pnpm pack --pack-destination "$PACK_DIR" >/dev/null)
TARBALL="$PACK_DIR/ttsc-vscode-$VERSION.tgz"
node scripts/assert-vscode-package.cjs "$TARBALL"

echo "==> Smoke-testing ttsc-vscode install shim"
SMOKE_DIR="$(mktemp -d)"
FAKE_BIN="$(mktemp -d)"
(
  cd "$SMOKE_DIR"
  npm init -y >/dev/null
  npm install "$TARBALL" >/dev/null
  cat > "$FAKE_BIN/code" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$FAKE_CODE_ARGS"
SH
  chmod +x "$FAKE_BIN/code"
  export FAKE_CODE_ARGS="$SMOKE_DIR/code-args.txt"
  PATH="$FAKE_BIN:$PATH" node_modules/.bin/ttsc-vscode install
  node - "$VERSION" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const version = process.argv[2];
const args = fs.readFileSync(process.env.FAKE_CODE_ARGS, "utf8").trim().split("\n");
const expected = path.join(
  process.cwd(),
  "node_modules",
  "@ttsc",
  "vscode",
  "dist",
  `ttsc-vscode-${version}.vsix`,
);
const want = ["--install-extension", expected, "--force"];
if (JSON.stringify(args) !== JSON.stringify(want)) {
  throw new Error(`unexpected code args: ${JSON.stringify(args)} !== ${JSON.stringify(want)}`);
}
NODE
)

# Dry-run: pnpm pack to /tmp instead of publishing. pnpm 10.x's pack/publish
# don't accept --dir for these subcommands (they fall through to npm), so we
# cd into the package directory.
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "==> DRY_RUN=1; packing only (no publish)"
  cp "$TARBALL" "/tmp/ttsc-vscode-$VERSION.tgz"
  echo "==> /tmp/ttsc-vscode-$VERSION.tgz contents:"
  tar -tzf "/tmp/ttsc-vscode-$VERSION.tgz"
  exit 0
fi

# Local publish skips --provenance (needs GitHub Actions OIDC).
echo "==> Publishing @ttsc/vscode@$VERSION"
(cd "$PKG_DIR" && pnpm publish --tag latest --access public --no-git-checks)

echo "==> Done. Verifying:"
npm view "@ttsc/vscode" version
