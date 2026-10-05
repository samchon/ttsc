if (!require("node:worker_threads").isMainThread) return;

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.dirname(__dirname);
const launcher = path.dirname(process.env.TTSC_E2E_INSTALLED_TTSX);
const { TtscCompiler } = require(path.join(launcher, "../TtscCompiler.js"));
const { runTtsc } = require(path.join(launcher, "internal/runTtsc.js"));
const artifacts = path.join(root, "tools/runtime-declared-artifacts");
const inputs = new Map([
  "runtime-declared.json", "runtime-base.json", "runtime-owned.json",
  "src/runtime-corpus/native-factory.ts", "src/runtime-corpus/excluded-owner.ts",
  "src/runtime-corpus/declared-owned.cts", "src/runtime-corpus/declaration-entry.cts",
  "tools/configured-owners/legacy/tsconfig.json", "tools/configured-owners/legacy/src/register-entry.tsx",
  "tools/configured-owners/legacy/src/register-view.tsx",
  "src/runtime-corpus/descendant-lazy.cts", "tools/runtime-descendant/worker.cjs",
  "tools/runtime-declared-script.ts", "tools/runtime-placement.ts",
  "tools/native-emission/tsconfig.json", "tools/native-emission/banner.config.json",
  "tools/native-emission/src/main.ts", "tools/native-emission/src/lib/value.ts",
  "tools/native-emission/src/package-entry.ts",
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
// Reporting is scoped to the Program that this dispatch actually loads. The
// shared root's bundle/map inputs do not belong to this nested source owner.
const emissionReports = {
  reportedFiles: ["src/main.ts", "src/lib/value.ts", "src/package-entry.ts"],
  reportedDependencies: [
    "src/main.ts", "src/lib/value.ts", "src/package-entry.ts",
    nativeConfigFile, path.join(nativeProject, "banner.config.json"),
    path.join(root, "config/strip.config.json"),
  ],
};
nativeOptions.compilerOptions.plugins = rootEntries.map((entry) => ({
  ...entry,
  ...(Object.hasOwn(entry, "reportedFiles") ? emissionReports : {}),
  transform: typeof entry.transform === "string" && entry.transform.startsWith(".") ? path.resolve(root, entry.transform) : entry.transform,
  ...(typeof entry.configFile === "string" ? { configFile: entry.transform === "@ttsc/banner" ? path.join(nativeProject, "banner.config.json") : path.resolve(root, entry.configFile) } : {}),
}));
const automaticManifestFile = path.join(root, "packages/batch-auto-discovery/package.json");
const automaticManifestBytes = fs.readFileSync(automaticManifestFile);
const automaticManifest = JSON.parse(automaticManifestBytes);
Object.assign(automaticManifest.ttsc.plugin, emissionReports);
const nativeEmitBefore = receiptCount();
try {
  fs.writeFileSync(nativeConfigFile, JSON.stringify(nativeOptions));
  fs.writeFileSync(automaticManifestFile, JSON.stringify(automaticManifest));
  assert.equal(runTtsc(["--cwd", nativeProject, "--emit"]), 0, "the actual public forced-emit dispatch must complete");
} finally {
  try { fs.writeFileSync(nativeConfigFile, nativeConfiguration); }
  finally { fs.writeFileSync(automaticManifestFile, automaticManifestBytes); }
}
assert.deepEqual(fs.readFileSync(automaticManifestFile), automaticManifestBytes, "the automatic contributor must return to the root Program's reporting epoch");
const nativeEmitAfter = receiptCount();
const emittedMain = fs.readFileSync(path.join(nativeProject, "dist/main.js"), "utf8");
assert.match(emittedMain, /from "\.\/lib\/value\.js"/);
assert.match(emittedMain, /marker = 100/);
assert.match(emittedMain, /confined/);
assert.match(fs.readFileSync(path.join(nativeProject, "dist/package-entry.js"), "utf8"), /dep = 1/);
assert.equal(fs.existsSync(path.join(nativeProject, "src/package-entry.js")), false, "the legal raw package self-reference must publish under dist, not beside its input");
unchanged();
const registerBefore = receiptCount();
const rejectedEnv = { ...process.env };
for (const name of ["TTSX_RUNTIME_MANIFEST", "TTSX_RUNTIME_CACHE_DIR", "TTSX_RUNTIME_RUN_DIR", "TTSX_RUNTIME_RUNS_DIR"])
  delete rejectedEnv[name];
const rejected = spawnSync(process.execPath, [
  "--require", path.join(__dirname, "runtime-negative/preload.cjs"), process.env.TTSC_E2E_INSTALLED_TTSX,
  "--cwd", root, "--strict", "-P", "runtime-owned.json", "--no-plugins", "@tools/runtime-negative/args.txt", "tools/runtime-negative/script.js",
], { cwd: root, env: rejectedEnv, encoding: "utf8", windowsHide: true });
if (rejected.error || rejected.signal !== null || rejected.status === null || !(rejected.pid > 0))
  throw new Error("rejection actor closure remained unresolved", { cause: rejected.error ?? new Error(JSON.stringify({ signal: rejected.signal, status: rejected.status, pid: rejected.pid })) });
assert.equal(rejected.error, undefined);
assert.equal(rejected.signal, null);
assert.equal(rejected.status, 2, rejected.stderr);
assert.ok(rejected.pid > 0);
try { process.kill(rejected.pid, 0); throw new Error("rejection actor closure remained unresolved"); }
catch (error) { if (error.code !== "ESRCH") throw error; }
const readonlyActive = process.env.TTSC_E2E_READONLY_DENIED === "1";
assert.equal(rejected.stdout.trim(), "Hello Class Foo\nHello Function getBar\nabc\nTTSC_RESPONSE_OPTIONAL:true\nTTSC_RESPONSE_JSX:<div>hello</div><b>world</b>\nread-only-ran\nHello Class Foo\nHello Function getBar\nabc\nTTSC_RESPONSE_OPTIONAL:false\nTTSC_RESPONSE_JSX:<div>hello</div><b>world</b>\nincluded-ran", "the two existing entry children must preserve complete decorator effects, opposite native response targets and automatic/forwarded preserved JSX");
assert.doesNotMatch(rejected.stdout, /(?:^|\r?\n)(?:ran|outside-ran)(?:\r?\n|$)/, "neither the refused JavaScript entry nor the excluded typed entry may execute");
assert.match(rejected.stderr, /-r requires a value/);
assert.match(rejected.stderr, /ttsx: entry not found:/);
assert.match(rejected.stderr, /missing-entry\.ts/);
for (const option of ["--project", "--no-plugins", "--strict", "@tools/runtime-negative/args.txt"])
  assert.ok(rejected.stderr.split(/\r?\n/).some((line) => line.includes("ttsx:") && line.includes(option)), "the actual JavaScript refusal must name " + option);
assert.match(rejected.stderr, /script\.js is JavaScript/);
assert.match(rejected.stderr, /TS6046/);
if (readonlyActive) {
  assert.match(rejected.stderr, /is not writable/);
  assert.ok(rejected.stderr.includes(process.env.TTSC_E2E_READONLY_ROOT));
  assert.match(rejected.stderr, /"include" or "files"/);
}
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, "runtime-negative/observed.json"), "utf8")),
  { statuses: [2, 2], exitCode: 2, pid: rejected.pid,
    readonly: readonlyActive ? { skipped: false, statuses: [0, 2, 0] } : { skipped: true, statuses: [] },
    response: { statuses: [0, 0, 2] } });
assert.equal(receiptCount(), registerBefore, "frontend refusals and plugin-free readonly calls must not execute a context-reporting fixture contributor; this is not a raw compiler/Program count");
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
const registerBaseFile = path.join(root, "runtime-base.json");
const registerBaseBytes = fs.readFileSync(registerBaseFile);
const registerOptions = JSON.parse(registerBaseBytes);
// The register loads the whole project and isolated requested roots. Each
// reporting entry obtains sources from that actual Program, rather than
// claiming that the root bundle/map population belongs to every requested root.
const registerReports = (entry) => {
  if (!Object.hasOwn(entry, "reportedFiles")) return entry;
  const { reportedFiles, reportedDependencies, ...options } = entry;
  return { ...options, reportedProgramSources: true, reportedDependencies: [] };
};
registerOptions.compilerOptions.plugins = registerOptions.compilerOptions.plugins.map(registerReports);
const registerAutomatic = JSON.parse(automaticManifestBytes);
registerAutomatic.ttsc.plugin = registerReports(registerAutomatic.ttsc.plugin);
let childReport;
let childIsRunning;
const descendant = path.join(__dirname, "runtime-descendant");
try {
fs.writeFileSync(registerBaseFile, JSON.stringify(registerOptions));
fs.writeFileSync(automaticManifestFile, JSON.stringify(registerAutomatic));
fs.copyFileSync(registerBaseFile, configuration);
try {
  const env = { ...process.env };
  delete env.TTSX_RUNTIME_MANIFEST;
  delete env.TTSX_RUNTIME_CACHE_DIR;
  delete env.TTSX_RUNTIME_RUN_DIR;
  delete env.TTSX_RUNTIME_RUNS_DIR;
  delete env.TTSC_CACHE_DIR;
  env.TEMP = env.TMP = env.TMPDIR = temporary;
  registered = spawnSync(process.execPath,
    ["--require", path.join(launcher, "../register.js"), path.join(root, "tools/configured-owners/legacy/src/register-entry.tsx")],
    { cwd: root, env, encoding: "utf8", windowsHide: true });
} finally {
  fs.unlinkSync(configuration);
}
childReport = fs.existsSync(path.join(descendant, "parent.json")) ? JSON.parse(fs.readFileSync(path.join(descendant, "parent.json"), "utf8")) : undefined;
childIsRunning = () => {
  if (childReport === undefined) return false;
  assert.ok(Number.isSafeInteger(childReport.child) && childReport.child > 0);
  try { process.kill(childReport.child, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
};
const defaultRuntime = path.join(root, "node_modules/.cache/ttsc/ttsx");
const defaultRuns = path.join(defaultRuntime, "project");
const cleanDefault = () => {
  const cache = process.env.TTSC_CACHE_DIR;
  try { delete process.env.TTSC_CACHE_DIR; return runTtsc(["clean", "--cwd", root]); }
  finally { if (cache === undefined) delete process.env.TTSC_CACHE_DIR; else process.env.TTSC_CACHE_DIR = cache; }
};
const descendantFailures = [];
try {
  assert.equal(registered.error, undefined);
  assert.equal(registered.signal, null);
  assert.equal(registered.status, 0, registered.stderr);
  assert.ok(registered.pid > 0);
  assert.throws(() => process.kill(registered.pid, 0), (error) => error.code === "ESRCH");
  assert.equal(registered.stdout.trim(), 'TTSC_REGISTER_VIEW:<div>hello</div><b>world</b>\nlowered\nentry\nTTSC_DECLARED_REGISTER:{"generated":42,"neighbor":43,"payload":42}');
  assert.equal(lowerings(defaultOrphans).filter((name) => !defaultBefore.has(name)).length, 1, "the manifestless register entry must prepare a default project-local cache and lower its excluded input there");
  assert.equal(fs.existsSync(path.join(temporary, "ttsc-orphan")), false, "neither placement may retain its lowering in the temporary directory");
  assert.ok(childReport, "the actual registered parent must publish its owned child identity");
  assert.equal(childReport.parent, registered.pid);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(descendant, "ready.json"), "utf8")), { pid: childReport.child });
  assert.equal(childIsRunning(), true, "the registered parent must exit while its actual descendant still owns the run");
  assert.equal(fs.readdirSync(defaultRuns).length, 1);
  assert.equal(cleanDefault(), 0);
  assert.equal(fs.readdirSync(defaultRuns).length, 1, "default clean must preserve the actual live descendant owner");
  fs.writeFileSync(path.join(descendant, "release"), "release");
  const deadline = Date.now() + 30000;
  while (!fs.existsSync(path.join(descendant, "result")) || childIsRunning()) {
    assert.ok(Date.now() < deadline, "the released descendant did not finish its actual lazy import");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  }
  assert.equal(fs.readFileSync(path.join(descendant, "result"), "utf8"), "descendant-ready");
  assert.equal(cleanDefault(), 0);
  assert.equal(fs.existsSync(defaultRuntime), false, "default clean must remove the completed registered run");
} catch (error) { descendantFailures.push(error); }
finally {
  fs.writeFileSync(path.join(descendant, "release"), "release");
  try {
    const deadline = Date.now() + 30000;
    while (childIsRunning()) {
      assert.ok(Date.now() < deadline, "registered descendant closure remained unresolved");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  } catch (error) { descendantFailures.push(new Error("registered descendant closure remained unresolved", { cause: error })); }
}
if (descendantFailures.length) throw new AggregateError(descendantFailures, "registered descendant live/lazy/finished cleanup");
} finally {
  if (childIsRunning !== undefined && childIsRunning())
    throw new Error("register reporting epoch retained because its descendant closure is unresolved");
  try { fs.writeFileSync(registerBaseFile, registerBaseBytes); }
  finally { fs.writeFileSync(automaticManifestFile, automaticManifestBytes); }
}
assert.deepEqual(fs.readFileSync(automaticManifestFile), automaticManifestBytes, "register reporting must restore the root discovery contributor after its descendant closes");
unchanged();
fs.writeFileSync(path.join(__dirname, "runtime-declared-observed.json"), JSON.stringify({ produced: [...seed.keys()].map((file) => path.relative(artifacts, file)).sort(), nativeEmitBefore, nativeEmitAfter, registerStatus: registered.status, registerPid: registered.pid, descendantPid: childReport.child, descendantResult: fs.readFileSync(path.join(descendant, "result"), "utf8"), descendantClosed: !childIsRunning(), registerBefore, registerAfter: receiptCount() }));
