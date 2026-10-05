if (!require("node:worker_threads").isMainThread) return;

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.dirname(__dirname);
const launcher = path.dirname(process.env.TTSC_E2E_INSTALLED_TTSX);
const { TtscCompiler } = require(path.join(launcher, "../TtscCompiler.js"));
const artifacts = path.join(root, "tools/runtime-declared-artifacts");
const inputs = new Map([
  "runtime-declared.json", "runtime-base.json", "runtime-owned.json",
  "src/runtime-corpus/native-factory.ts", "src/runtime-corpus/excluded-owner.ts",
  "src/runtime-corpus/declared-owned.cts", "src/runtime-corpus/declaration-entry.cts",
  "tools/runtime-declared-script.ts",
].map((relative) => [path.join(root, relative), fs.readFileSync(path.join(root, relative))]));
assert.equal(fs.existsSync(artifacts), false);
const compiled = new TtscCompiler({ cwd: root, tsconfig: "runtime-declared.json", plugins: false }).compile();
assert.equal(compiled.type, "success", JSON.stringify(compiled));
const output = new Map(Object.entries(compiled.output).map(([file, text]) => [path.resolve(root, file), text]));
const declaration = path.join(artifacts, "types/runtime-corpus/native-factory.d.ts");
const declarationMap = declaration + ".map";
const buildInfo = path.join(artifacts, "state/app.tsbuildinfo");
assert.match(output.get(declaration), /export interface Payload/);
assert.match(output.get(declaration), /value: number/);
assert.match(output.get(declaration), /__TTSC_NATIVE_FACTORY_ARROW__/);
const map = JSON.parse(output.get(declarationMap));
assert.equal(map.version, 3);
assert.ok(map.mappings.length > 0);
assert.ok(map.sources.some((source) => source.endsWith("/native-factory.ts")));
assert.equal(typeof output.get(buildInfo), "string");
for (const [file, text] of output) {
  const relative = path.relative(artifacts, file);
  assert.ok(relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative), "actual seed outputs must belong to the declared artifact root");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const seed = new Map([...output.keys()].map((file) => [file, fs.readFileSync(file)]));
const unchanged = () => {
  for (const [file, bytes] of seed) assert.deepEqual(fs.readFileSync(file), bytes, "actual runtime delivery must preserve every produced declaration, map and build-info byte");
  for (const [file, bytes] of inputs) assert.deepEqual(fs.readFileSync(file), bytes, "each delivery must preserve its authored source and compiler configuration");
  for (const relative of ["src/runtime-corpus/native-factory.js", "src/runtime-corpus/declared-owned.cjs", "src/runtime-corpus/declaration-entry.cjs", "tools/runtime-declared-script.js"])
    assert.equal(fs.existsSync(path.join(root, relative)), false, "runtime delivery must not emit beside its authored input");
};
assert.deepEqual(require(path.join(root, "src/runtime-corpus/native-factory.ts")).observed,
  { generated: 42, neighbor: 43, payload: 42 });
assert.equal(require(path.join(root, "src/runtime-corpus/declared-owned.cts")).value, "entry");
unchanged();
assert.equal(require(path.join(root, "tools/runtime-declared-script.ts")).value, "tool");
unchanged();
const configuration = path.join(root, "tsconfig.json");
assert.equal(fs.existsSync(configuration), false, "the parent holds this existing compiler input as runtime-base.json");
fs.copyFileSync(path.join(root, "runtime-base.json"), configuration);
let registered;
const contextFile = path.join(root, "native-context.jsonl");
const receiptCount = () => fs.readFileSync(contextFile, "utf8").trim().split(/\r?\n/).length;
const registerBefore = receiptCount();
try {
  const env = { ...process.env };
  delete env.TTSX_RUNTIME_MANIFEST;
  delete env.TTSX_RUNTIME_CACHE_DIR;
  delete env.TTSX_RUNTIME_RUN_DIR;
  delete env.TTSX_RUNTIME_RUNS_DIR;
  registered = spawnSync(process.execPath,
    ["--require", path.join(launcher, "../register.js"), path.join(root, "src/runtime-corpus/declaration-entry.cts")],
    { cwd: root, env, encoding: "utf8", windowsHide: true });
} finally {
  fs.unlinkSync(configuration);
}
assert.equal(registered.error, undefined);
assert.equal(registered.signal, null);
assert.equal(registered.status, 0, registered.stderr);
assert.ok(registered.pid > 0);
assert.throws(() => process.kill(registered.pid, 0), (error) => error.code === "ESRCH");
assert.equal(registered.stdout.trim(), 'entry\nTTSC_DECLARED_REGISTER:{"generated":42,"neighbor":43,"payload":42}');
unchanged();
fs.writeFileSync(path.join(__dirname, "runtime-declared-observed.json"), JSON.stringify({ produced: [...seed.keys()].map((file) => path.relative(artifacts, file)).sort(), registerStatus: registered.status, registerPid: registered.pid, registerBefore, registerAfter: receiptCount() }));
