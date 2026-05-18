// Builds website/public/compiler/typia-runtime-pack.json — a CommonJS bundle
// the playground's Execute sandbox uses to resolve typia/@typia/randexp
// requires emitted by typia's source transform.
//
// Unlike pack-typia-sources.cjs (which ships TypeScript source so the wasm's
// tsgo can typecheck `import typia, { tags } from "typia"`), this pack ships
// the published JS so the Execute sandbox can actually call typia helpers at
// runtime.
//
// Why it exists:
//   The typia transform emits calls like
//     require("typia/lib/internal/_isFormatEmail")
//   in the CommonJS bundle the Execute sandbox runs. Without those modules
//   resolvable, every "Execute" hit throws
//     require("typia/lib/internal/...") is not available in the playground sandbox.
//
// Source roots: website/compiler-dependencies/node_modules/. That tree has
// typia + transitive deps pinned to the same version the playground wasm was
// built against, installed by npm (not pnpm) so hoisting matches a normal
// consumer install.
//
// Output shape: { [absoluteSpec]: jsCode }. Mounts under sandbox-relative
// paths like `typia/lib/internal/_isFormatEmail.js`.

const fs = require("fs");
const path = require("path");

const websiteRoot = path.resolve(__dirname, "..");
const depsRoot = path.join(websiteRoot, "compiler-dependencies", "node_modules");
const outFile = path.join(
  websiteRoot,
  "public",
  "compiler",
  "typia-runtime-pack.json",
);

// Each entry packs `<pkgDir>/lib/**/*.js` (or full tree for randexp & friends
// which don't have a lib/ subdir). Maps & ESM `.mjs` variants are skipped:
// the sandbox is CJS-only so mjs only adds weight.
const SOURCES = [
  { name: "typia", root: path.join(depsRoot, "typia"), pickDirs: ["lib"], pickRoot: true },
  { name: "@typia/utils", root: path.join(depsRoot, "@typia/utils"), pickDirs: ["lib"], pickRoot: true },
  { name: "@typia/core", root: path.join(depsRoot, "@typia/core"), pickDirs: ["lib"], pickRoot: true },
  { name: "@typia/interface", root: path.join(depsRoot, "@typia/interface"), pickDirs: ["lib"], pickRoot: true },
  // randexp + its transitive runtime deps (typia.random's regex generators).
  { name: "randexp", root: path.join(depsRoot, "randexp"), pickDirs: ["lib"], pickRoot: true },
  { name: "ret", root: path.join(depsRoot, "ret"), pickDirs: ["lib"], pickRoot: true },
  { name: "drange", root: path.join(depsRoot, "drange"), pickDirs: ["lib"], pickRoot: true },
  { name: "discontinuous-range", root: path.join(depsRoot, "discontinuous-range"), pickDirs: [], pickRoot: true },
];

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out;
}

const KEEP = /\.js$/;
const SKIP = /(\.mjs|\.map|\.d\.ts|\.test\.js|\.spec\.js)$/;

function packDir(out, pkgName, pkgRoot, sub) {
  const start = path.join(pkgRoot, sub);
  if (!fs.existsSync(start)) return;
  for (const file of walk(start)) {
    if (SKIP.test(file)) continue;
    if (!KEEP.test(file)) continue;
    const rel = path.relative(pkgRoot, file).split(path.sep).join("/");
    out[`${pkgName}/${rel}`] = fs.readFileSync(file, "utf8");
  }
}

function packPackageJson(out, pkgName, pkgRoot) {
  const pj = path.join(pkgRoot, "package.json");
  if (fs.existsSync(pj)) {
    out[`${pkgName}/package.json`] = fs.readFileSync(pj, "utf8");
  }
}

function main() {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const pack = {};
  for (const source of SOURCES) {
    if (!fs.existsSync(source.root)) {
      console.warn(`[pack-typia-runtime] missing ${source.name} at ${source.root}`);
      continue;
    }
    if (source.pickRoot) packPackageJson(pack, source.name, source.root);
    if (source.pickDirs.length === 0) {
      // Pack the entire package root (excluding node_modules, maps, mjs).
      for (const file of walk(source.root)) {
        if (SKIP.test(file)) continue;
        if (!KEEP.test(file)) continue;
        const rel = path.relative(source.root, file).split(path.sep).join("/");
        pack[`${source.name}/${rel}`] = fs.readFileSync(file, "utf8");
      }
    } else {
      for (const sub of source.pickDirs) packDir(pack, source.name, source.root, sub);
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(pack));
  const stats = fs.statSync(outFile);
  console.log(
    `[pack-typia-runtime] wrote ${Object.keys(pack).length} files (${(
      stats.size / 1024
    ).toFixed(1)} KB) to ${path.relative(websiteRoot, outFile)}`,
  );
}

main();
