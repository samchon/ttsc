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
  "tools/runtime-declared-script.ts", "tools/runtime-placement.ts",
  "tools/native-emission/tsconfig.json", "tools/native-emission/banner.config.json",
  "tools/native-emission/src/main.ts", "tools/native-emission/src/lib/value.ts",
  "src/native-public-dependency/index.ts",
  "tools/runtime-negative/args.txt", "tools/runtime-negative/script.js", "tools/runtime-negative/preload.cjs",
].map((relative) => [path.join(root, relative), fs.readFileSync(path.join(root, relative))]));
assert.equal(fs.existsSync(artifacts), false);
const missingDescriptor = path.join(root, "missing-plugin.cjs");
assert.equal(fs.existsSync(missingDescriptor), false);
const compiled = new TtscCompiler({ cwd: root, tsconfig: "runtime-declared.json", plugins: false }).compile();
assert.equal(compiled.type, "success", JSON.stringify(compiled));
assert.equal(fs.existsSync(missingDescriptor), false, "plugins:false must bypass the actually configured absent descriptor");
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
  for (const relative of ["src/runtime-corpus/native-factory.js", "src/runtime-corpus/declared-owned.cjs", "src/runtime-corpus/declaration-entry.cjs", "tools/runtime-declared-script.js", "tools/runtime-placement.js"])
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
let registered;
const contextFile = path.join(root, "native-context.jsonl");
const receiptCount = () => fs.readFileSync(contextFile, "utf8").trim().split(/\r?\n/).length;
const nativeProject = path.join(__dirname, "native-emission");
const nativeConfigFile = path.join(nativeProject, "tsconfig.json");
const nativeConfiguration = fs.readFileSync(nativeConfigFile);
const nativeOptions = JSON.parse(nativeConfiguration);
const rootEntries = JSON.parse(fs.readFileSync(path.join(root, "runtime-base.json"), "utf8")).compilerOptions.plugins;
nativeOptions.compilerOptions.plugins = rootEntries.map((entry) => ({
  ...entry,
  transform: typeof entry.transform === "string" && entry.transform.startsWith(".") ? path.resolve(root, entry.transform) : entry.transform,
  ...(typeof entry.configFile === "string" ? { configFile: entry.transform === "@ttsc/banner" ? path.join(nativeProject, "banner.config.json") : path.resolve(root, entry.configFile) } : {}),
}));
const nativeEmitBefore = receiptCount();
try {
  fs.writeFileSync(nativeConfigFile, JSON.stringify(nativeOptions));
  const { runTtsc } = require(path.join(launcher, "internal/runTtsc.js"));
  assert.equal(runTtsc(["--cwd", nativeProject, "--emit"]), 0, "the actual public forced-emit dispatch must complete");
} finally {
  fs.writeFileSync(nativeConfigFile, nativeConfiguration);
}
const nativeEmitAfter = receiptCount();
const emittedMain = fs.readFileSync(path.join(nativeProject, "dist/main.js"), "utf8");
assert.match(emittedMain, /from "\.\/lib\/value\.js"/);
assert.match(emittedMain, /marker = 100/);
assert.match(emittedMain, /confined/);
assert.deepEqual(fs.readdirSync(path.join(root, "src/native-public-dependency"), { recursive: true }).filter((file) => String(file).endsWith(".js")), [], "forced emission must not publish into the raw self-referenced dependency source tree");
unchanged();
const registerBefore = receiptCount();
const rejected = spawnSync(process.execPath, [
  "--require", path.join(__dirname, "runtime-negative/preload.cjs"), process.env.TTSC_E2E_INSTALLED_TTSX,
  "--cwd", root, "--strict", "-P", "runtime-owned.json", "--no-plugins", "@tools/runtime-negative/args.txt", "tools/runtime-negative/script.js",
], { cwd: root, env: process.env, encoding: "utf8", windowsHide: true });
assert.equal(rejected.error, undefined);
assert.equal(rejected.signal, null);
assert.equal(rejected.status, 2, rejected.stderr);
assert.ok(rejected.pid > 0);
assert.throws(() => process.kill(rejected.pid, 0), (error) => error.code === "ESRCH");
assert.equal(rejected.stdout, "", "none of the refused preflight inputs may execute the JavaScript ran effect");
assert.match(rejected.stderr, /-r requires a value/);
assert.match(rejected.stderr, /ttsx: entry not found:/);
assert.match(rejected.stderr, /missing-entry\.ts/);
for (const option of ["--project", "--no-plugins", "--strict", "@tools/runtime-negative/args.txt"])
  assert.ok(rejected.stderr.split(/\r?\n/).some((line) => line.includes("ttsx:") && line.includes(option)), "the actual JavaScript refusal must name " + option);
assert.match(rejected.stderr, /script\.js is JavaScript/);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, "runtime-negative/observed.json"), "utf8")),
  { statuses: [2, 2], exitCode: 2, pid: rejected.pid });
assert.equal(receiptCount(), registerBefore, "these frontend refusals must not reach native preparation");
unchanged();
const explicitOrphans = path.join(process.env.TTSC_CACHE_DIR, "ttsx-orphan");
const defaultOrphans = path.join(root, "node_modules/.cache/ttsc/ttsx-orphan");
const temporary = path.join(__dirname, "runtime-placement-temp");
assert.equal(fs.existsSync(temporary), false);
fs.mkdirSync(temporary);
const lowerings = (directory) => fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.endsWith(".js")) : [];
const explicitBefore = new Set(lowerings(explicitOrphans));
const previousTemporary = Object.fromEntries(["TEMP", "TMP", "TMPDIR"].map((name) => [name, process.env[name]]));
try {
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = temporary;
  assert.equal(require(path.join(__dirname, "runtime-placement.ts")).value, "lowered");
} finally {
  for (const [name, value] of Object.entries(previousTemporary)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
assert.equal(lowerings(explicitOrphans).filter((name) => !explicitBefore.has(name)).length, 1, "the explicit runtime cache must receive this one actual orphan lowering");
const defaultBefore = new Set(lowerings(defaultOrphans));
fs.copyFileSync(path.join(root, "runtime-base.json"), configuration);
try {
  const env = { ...process.env };
  delete env.TTSX_RUNTIME_MANIFEST;
  delete env.TTSX_RUNTIME_CACHE_DIR;
  delete env.TTSX_RUNTIME_RUN_DIR;
  delete env.TTSX_RUNTIME_RUNS_DIR;
  delete env.TTSC_CACHE_DIR;
  env.TEMP = env.TMP = env.TMPDIR = temporary;
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
assert.equal(registered.stdout.trim(), 'lowered\nentry\nTTSC_DECLARED_REGISTER:{"generated":42,"neighbor":43,"payload":42}');
assert.equal(lowerings(defaultOrphans).filter((name) => !defaultBefore.has(name)).length, 1, "the manifestless register entry must prepare a default project-local cache and lower its excluded input there");
assert.equal(fs.existsSync(path.join(temporary, "ttsc-orphan")), false, "neither placement may retain its lowering in the temporary directory");
unchanged();
fs.writeFileSync(path.join(__dirname, "runtime-declared-observed.json"), JSON.stringify({ produced: [...seed.keys()].map((file) => path.relative(artifacts, file)).sort(), nativeEmitBefore, nativeEmitAfter, registerStatus: registered.status, registerPid: registered.pid, registerBefore, registerAfter: receiptCount() }));
