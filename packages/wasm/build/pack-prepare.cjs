// prepack/postpack helper for @ttsc/wasm.
//
// `pnpm pack` and `npm publish` both honor `files` against the working
// directory's `go.mod`, so the published tarball would otherwise carry the
// dev-time `replace ../ttsc/shim/*` paths. Those paths don't exist inside
// the consumer's `node_modules/@ttsc/wasm/`, so the module would fail to
// resolve.
//
// build-wasm.cjs emits a rewritten `dist/go.mod` that points at the
// vendored `./vendor/shim/*` tree. Pack-prepare swaps the working-tree
// `go.mod` for that copy just before pack, then restores the original
// afterwards. The original is stashed in `build/.go.mod.stash` so an
// interrupted pack can be recovered by running `--restore`.
//
// Usage:
//   node build/pack-prepare.cjs --stash    # prepack: stash + swap
//   node build/pack-prepare.cjs --restore  # postpack: restore stash

const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const goModPath = path.join(packageRoot, "go.mod");
const publishedGoMod = path.join(packageRoot, "dist", "go.mod");
// Stash lives in node_modules/.cache to keep it out of the tarball (node_modules
// is never packed). Using package-local dist/ would risk shipping the stash;
// __dirname (`build/`) is in `files` so the stash would leak too.
const stashDir = path.join(packageRoot, "node_modules", ".cache", "ttsc-wasm");
const stashPath = path.join(stashDir, "go.mod.stash");

function stash() {
  if (!fs.existsSync(publishedGoMod)) {
    throw new Error(
      `pack-prepare: dist/go.mod missing. Run \`pnpm --filter @ttsc/wasm build\` first.`,
    );
  }
  if (fs.existsSync(stashPath)) {
    throw new Error(
      `pack-prepare: stale stash at ${stashPath}. Run \`--restore\` first or delete the stash.`,
    );
  }
  fs.mkdirSync(stashDir, { recursive: true });
  fs.copyFileSync(goModPath, stashPath);
  fs.copyFileSync(publishedGoMod, goModPath);
  console.log("pack-prepare: swapped go.mod for published copy");
}

function restore() {
  if (!fs.existsSync(stashPath)) {
    console.log("pack-prepare: no stash to restore");
    return;
  }
  fs.copyFileSync(stashPath, goModPath);
  fs.rmSync(stashPath);
  console.log("pack-prepare: restored working-tree go.mod");
}

const mode = process.argv[2];
if (mode === "--stash") {
  stash();
} else if (mode === "--restore") {
  restore();
} else {
  console.error(
    "pack-prepare: usage: node build/pack-prepare.cjs [--stash|--restore]",
  );
  process.exit(2);
}
