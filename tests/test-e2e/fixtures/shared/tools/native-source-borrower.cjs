// Node capability workers inherit -r. These mutations belong to the main
// Runtime consumer; workers still run the product's runtime hooks.
if (!require("node:worker_threads").isMainThread) return;

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The existing runtime owner has installed its hooks before this preload.
// Borrow the actual shared publication only for these two orphan loads, then
// restore the installed compiler authority before the ordinary entry runs.
const root = path.dirname(__dirname);
const source = path.join(root, "node_modules/batch-native-source-race/index.ts");
const done = path.join(root, "tools/source-publication/source-race-done");
const report = path.join(root, "tools/source-publication/runtime-borrower.json");
const original = fs.readFileSync(source);
const names = ["TTSC_TSGO_BINARY", "ORPHAN_RACE_SOURCE", "ORPHAN_RACE_DONE", "ORPHAN_RACE_COMPILER"];
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
assert.equal(fs.existsSync(done), false);
assert.equal(fs.existsSync(report), false);
assert.equal(typeof process.env.TTSC_E2E_SOURCE_PUBLICATION, "string");
assert.equal(typeof process.env.TTSC_E2E_ORPHAN_COMPILER, "string");
try {
  process.env.TTSC_TSGO_BINARY = process.env.TTSC_E2E_SOURCE_PUBLICATION;
  process.env.ORPHAN_RACE_COMPILER = process.env.TTSC_E2E_ORPHAN_COMPILER;
  process.env.ORPHAN_RACE_SOURCE = source;
  process.env.ORPHAN_RACE_DONE = done;
  const first = require(source).value;
  assert.equal(first, "two", "the real delegate changes the bytes that are actually lowered");
  assert.equal(fs.existsSync(done), true, "the native mutation branch must execute");
  assert.equal(fs.readFileSync(source, "utf8"), 'export const value: string = "two";\n');
  fs.writeFileSync(source, original);
  delete require.cache[require.resolve(source)];
  const second = require(source).value;
  assert.equal(second, "one", "the raced emit must not poison the original source key");
  fs.writeFileSync(report, JSON.stringify({ first, second, nativeMutation: true }));
} finally {
  fs.writeFileSync(source, original);
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}

// The same runtime now advances compiler identity while this excluded module
// and its manifest remain fixed. Reading the registry does not install or
// mutate a manifest, and the cache artifact comes from actual native lowering.
const launcher = path.dirname(process.env.TTSC_E2E_INSTALLED_TTSX);
const { RuntimeManifestRegistry } = require(path.join(launcher, "internal/runtime/RuntimeManifestRegistry.js"));
const manifest = RuntimeManifestRegistry.runtimeManifests().find((owner) => typeof owner.orphanCacheDir === "string" && owner.orphanCacheDir.length > 0);
assert.ok(manifest, "the actual runtime owner must name its orphan cache");
const orphanCache = manifest.orphanCacheDir;
const identitySource = path.join(path.dirname(source), "identity.ts");
const compilerRoot = path.join(root, "tools/source-publication/identity-compiler");
assert.equal(fs.existsSync(compilerRoot), false);
fs.cpSync(path.dirname(process.env.TTSC_E2E_ORPHAN_COMPILER), compilerRoot, { recursive: true });
const compiler = path.join(compilerRoot, path.basename(process.env.TTSC_E2E_ORPHAN_COMPILER));
fs.chmodSync(compiler, 0o755);
const stamp = 1700000000;
fs.utimesSync(compiler, stamp, stamp);
const compilerBytes = fs.readFileSync(compiler);
// The copied compiler must perform the same native lowering operation before
// the cache comparison epoch. --version alone did not establish that premise:
// an actual lowering changed ctime between otherwise equal stable identities.
// This preparation emits an independent source outside the orphan cache. It
// neither supplies that cache's output nor permits a changed identity at its
// subsequent admission. Rewriting the executable starts a new preparation
// epoch and must still refuse the old marked artifact.
const { RuntimeIsolatedEmit } = require(path.join(launcher, "internal/runtime/RuntimeIsolatedEmit.js"));
const preparationSource = path.join(compilerRoot, "compiler-preparation.ts");
const preparationOutput = path.join(compilerRoot, "preparation-output");
fs.writeFileSync(preparationSource, 'export const prepared: string = "native preparation";\n');
fs.mkdirSync(preparationOutput);
const preparations = [];
const prepareCompiler = () => {
  const before = fs.statSync(compiler, { bigint: true });
  const result = require("node:child_process").spawnSync(compiler,
    RuntimeIsolatedEmit.compilerArgs(preparationSource, preparationOutput, "commonjs", "execution"), {
    cwd: preparationOutput,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(preparationOutput, "compiler-preparation.js"), "utf8"), /native preparation/);
  const after = fs.statSync(compiler, { bigint: true });
  preparations.push({ beforeCtime: String(before.ctimeNs), afterCtime: String(after.ctimeNs), status: result.status });
};
prepareCompiler();
const priorCompiler = process.env.TTSC_TSGO_BINARY;
try {
  process.env.TTSC_TSGO_BINARY = compiler;
  const beforeEntries = new Set(fs.existsSync(orphanCache) ? fs.readdirSync(orphanCache) : []);
  const initial = require(identitySource);
  assert.equal(initial.value, "lowered");
  const published = fs.readdirSync(orphanCache).filter((name) => name.endsWith(".js") && !beforeEntries.has(name));
  assert.equal(published.length, 1, "one actual orphan lowering must publish its cache artifact");
  fs.appendFileSync(path.join(orphanCache, published[0]), '\nexports.cachedMarker = true;\n');
  delete require.cache[require.resolve(identitySource)];
  const warm = require(identitySource);
  assert.equal(warm.value, "lowered");
  assert.equal(warm.cachedMarker, true, "the unchanged executable must deliver the actual marked artifact");
  const before = fs.statSync(compiler, { bigint: true });
  fs.writeFileSync(compiler, compilerBytes);
  fs.utimesSync(compiler, stamp, stamp);
  const after = fs.statSync(compiler, { bigint: true });
  assert.equal(after.mtimeNs, before.mtimeNs);
  assert.equal(after.size, before.size);
  assert.deepEqual(fs.readFileSync(compiler), compilerBytes);
  prepareCompiler();
  delete require.cache[require.resolve(identitySource)];
  const rewritten = require(identitySource);
  assert.equal(rewritten.value, "lowered");
  assert.equal(rewritten.cachedMarker, undefined, "a real same-byte executable rewrite must not borrow the marked old artifact");
  fs.writeFileSync(path.join(root, "tools/source-publication/runtime-identity.json"), JSON.stringify({ first: initial.value, warm: warm.value, warmMarker: warm.cachedMarker, rewritten: rewritten.value, rewrittenMarker: rewritten.cachedMarker === true, preparations }));
} finally {
  if (priorCompiler === undefined) delete process.env.TTSC_TSGO_BINARY;
  else process.env.TTSC_TSGO_BINARY = priorCompiler;
}

// Direct excluded delivery and an owned consumer require share one upfront
// package. The stale JavaScript stays present; only Node's delivery entry is
// withdrawn between loads, so the second route must resolve the typed source.
const staleSource = path.join(root, "node_modules/root-pkg/stale.ts");
assert.equal(require("root-pkg").value, "root-ran", "the actual installed package entry must execute without publishing into its input tree");
require("./observe-installed-banner.cjs")(root);
assert.equal(require(staleSource).tool, "fresh tool.ts");
delete require.cache[require.resolve(staleSource)];
assert.equal(require(path.join(root, "src/runtime-corpus/stale-reader.cts")).observed, "fresh tool.ts");

// The existing project alias carries an excluded typed source importing an
// admitted source from the same graph. Its real lowering must not emit beside
// either source or into the configured public output directory.
const excludedSource = path.join(process.env.TTSC_E2E_PROJECT_ALIAS, "tools/runtime-excluded.ts");
assert.equal(fs.realpathSync.native(process.env.TTSC_E2E_PROJECT_ALIAS), fs.realpathSync.native(root));
assert.equal(require(excludedSource).observed, "cleared world");
assert.equal(fs.existsSync(path.join(root, "tools/runtime-excluded.js")), false);
assert.equal(fs.existsSync(path.join(root, "src/runtime-corpus/excluded-owner.js")), false);
