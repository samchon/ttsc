if (!require("node:worker_threads").isMainThread) return;

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const actorController = require("./runtime-owned-descendant.cjs");
const actorFacts = { finished: false, success: false, actors: {}, inputsRestored: false, registerRestorationRequired: false, registerRestored: false, mainReportingAttempted: false, semanticErrors: [] };
const receiptFailures = [];
const saveActor = () => {
  try { actorController.publishOutcome("declared", actorFacts); }
  catch (cause) { receiptFailures.push(cause); }
};
let actorFailure;
let verifyActorInputs;
saveActor();
try {
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
  "src/runtime-corpus/package-boundary.cts",
  "tools/api-environment-layers.cjs", "tools/api-env-descriptor.cjs",
].map((relative) => [path.join(root, relative), fs.readFileSync(path.join(root, relative))]));
const boundaryRoot = path.join(root, "tools/runtime-package-boundary");
// Unoverridden builds for these package projects select this installation's
// documented default plugin cache. Its binaries are not authored fixture input.
const boundaryCache = path.join(boundaryRoot, "app/NODE_MODULES/.cache/ttsc");
const readBoundaryTree = () => {
  const files = new Map();
  const cache = fs.existsSync(boundaryCache) ? fs.realpathSync.native(boundaryCache) : undefined;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (cache === undefined || fs.realpathSync.native(file) !== cache) visit(file);
      } else if (entry.isFile()) files.set(file, fs.readFileSync(file));
    }
  };
  visit(boundaryRoot);
  return files;
};
const boundaryInputs = readBoundaryTree();
const boundaryExpected = JSON.parse(fs.readFileSync(path.join(boundaryRoot, "expected.json"), "utf8"));
assert.equal(fs.existsSync(artifacts), false);
const missingDescriptor = path.join(root, "missing-plugin.cjs");
assert.equal(fs.existsSync(missingDescriptor), false);
/**
 * Verifies public in-memory failures leave caller output and state unchanged.
 *
 * The initial absent descriptor is followed by seeded relative and absolute
 * state files, a deep inferred state path and an independent TS2322. All
 * cases borrow this installed preload actor and its existing native seed.
 *
 * 1. Reject the missing descriptor before caller output exists.
 * 2. Preserve seeded artifacts while recovery checks observe each state path.
 * 3. Restore source/config and capture the original plugin-free result again.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual installed TtscCompiler.compile rejects the missing descriptor, retains independent TS2322, returns no recovery artifacts and preserves every seeded declaration/map/build-info byte and the external sentinel.
 * @evidence contracts/testing.md#independent-expectations Authored missing descriptor and string-to-number assignment establish diagnostic identities. Previously captured native artifacts and literal sentinel bytes establish unchanged caller state; independently computed deep inferred destination must remain absent.
 * @evidence contracts/testing.md#distinguishing-cases Covers clean plugin setup rejection, existing relative state, existing absolute external state, deep inferred state and restored successful capture. Compiler failures collect independently and report to the owning batch after its shared runtime completes.
 * @evidence contracts/testing.md#execution-ownership This fixture body runs only in the main thread of test_e2e_runtime_batch's installed public runtime preload; the fixture is excluded from declaration selection and this body is not separately addressable by Evidence.
 * @evidence contracts/e2e.md#necessary-boundary Independent compiler recovery can write incremental metadata even without emission, which destination-composer units cannot prove absent through the installed API and selected native compiler connection.
 * @evidence contracts/e2e.md#shared-execution The existing installed runtime actor and native seed serve all rows. Recovery-only checks and restored API capture add compiler calls without another installation, native producer or host actor.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The copied config/source bytes restore in finally and only the new owned external sentinel is removed. Seeded caller files are never removed to hide a compiler write. No private cache clearing makes a row cold.
 * @evidence contracts/e2e.md#preserved-coverage Existing runtime declaration/map/state preservation assertions continue after these rows. Portable mapping and final argv expectations execute in their direct source units; each new native failure retains its row identity in the final observation.
 */
const apiFailures = [];
try {
  const initialRejectedApi = new TtscCompiler({ cwd: root, tsconfig: "runtime-declared.json" }).compile();
  assert.equal(initialRejectedApi.type, "failure", JSON.stringify(initialRejectedApi));
  assert.deepEqual(initialRejectedApi.output, {});
  assert.ok(initialRejectedApi.diagnostics.some((diagnostic) => String(diagnostic.messageText).includes("missing-plugin.cjs")));
  assert.equal(fs.existsSync(artifacts), false, "failed API recovery must not create the caller's declared output tree");
} catch (cause) { apiFailures.push(new Error("public API isolation: initially absent caller output", { cause })); }
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
const apiConfigFile = path.join(root, "runtime-declared.json");
const apiSourceFile = path.join(root, "src/runtime-corpus/native-factory.ts");
const apiConfigBytes = fs.readFileSync(apiConfigFile);
const apiSourceBytes = fs.readFileSync(apiSourceFile);
const externalApiState = path.join(root, "tools/api-external-state.tsbuildinfo");
const inferredApiState = path.join(root, "tools/runtime-declared.tsbuildinfo");
assert.equal(fs.existsSync(inferredApiState), false);
const externalApiSentinel = Buffer.from("caller-owned absolute build state\n");
assert.equal(fs.existsSync(externalApiState), false);
try {
  fs.writeFileSync(externalApiState, externalApiSentinel);
  for (const [name, buildInfo, rootDir] of [
    ["existing-relative-state", "tools/runtime-declared-artifacts/state/app.tsbuildinfo", "src"],
    ["absolute-external-state", externalApiState, "src"],
    ["deep-inferred-state", undefined, "src/runtime-corpus"],
  ]) {
    try {
      const config = JSON.parse(apiConfigBytes);
      config.compilerOptions.rootDir = rootDir;
      if (buildInfo === undefined) delete config.compilerOptions.tsBuildInfoFile;
      else config.compilerOptions.tsBuildInfoFile = buildInfo;
      fs.writeFileSync(apiConfigFile, JSON.stringify(config));
      fs.writeFileSync(apiSourceFile, Buffer.concat([apiSourceBytes, Buffer.from("\nconst apiIndependentTypeError: number = 'wrong';\n")]));
      const rejected = new TtscCompiler({ cwd: root, tsconfig: "runtime-declared.json" }).compile();
      assert.equal(rejected.type, "failure", JSON.stringify(rejected));
      assert.deepEqual(rejected.output, {});
      assert.ok(rejected.diagnostics.some((diagnostic) => String(diagnostic.messageText).includes("missing-plugin.cjs")));
      assert.ok(rejected.diagnostics.some((diagnostic) => diagnostic.code === 2322 && diagnostic.file?.endsWith("native-factory.ts")), "independent authored TypeScript error must survive plugin setup rejection");
      for (const [file, bytes] of seed) assert.deepEqual(fs.readFileSync(file), bytes, "API failure must preserve actual CLI-compatible seeded output bytes");
      assert.deepEqual(fs.readFileSync(externalApiState), externalApiSentinel);
      assert.equal(fs.existsSync(inferredApiState), false, "deep inferred build-info must never escape above the private output directory");
    } catch (cause) { apiFailures.push(new Error("public API isolation: " + name, { cause })); }
  }
} finally {
  try { fs.writeFileSync(apiConfigFile, apiConfigBytes); }
  finally {
    try { fs.writeFileSync(apiSourceFile, apiSourceBytes); }
    finally { fs.rmSync(externalApiState); }
  }
}
assert.deepEqual(fs.readFileSync(apiConfigFile), apiConfigBytes);
assert.deepEqual(fs.readFileSync(apiSourceFile), apiSourceBytes);
try {
  const recoveredApi = new TtscCompiler({ cwd: root, tsconfig: "runtime-declared.json", plugins: false }).compile();
  assert.equal(recoveredApi.type, "success", JSON.stringify(recoveredApi));
  assert.deepEqual(recoveredApi.output, compiled.output, "restoring source/config must restore the original captured artifacts");
  for (const [file, bytes] of seed) assert.deepEqual(fs.readFileSync(file), bytes);
} catch (cause) { apiFailures.push(new Error("public API isolation: restored capture", { cause })); }
const unchanged = () => {
  assert.deepEqual(readBoundaryTree(), boundaryInputs, "installed-boundary sources/configs must stay unchanged without adjacent output");
  for (const [file, bytes] of seed) assert.deepEqual(fs.readFileSync(file), bytes, "actual runtime delivery must preserve every produced declaration, map and build-info byte");
  for (const [file, bytes] of inputs) assert.deepEqual(fs.readFileSync(file), bytes, "each delivery must preserve its authored source and compiler configuration");
  for (const relative of ["src/runtime-corpus/native-factory.js", "src/runtime-corpus/declared-owned.cjs", "src/runtime-corpus/declaration-entry.cjs", "tools/runtime-declared-script.js", "tools/runtime-placement.js"])
    assert.equal(fs.existsSync(path.join(root, relative)), false, "runtime delivery must not emit beside its authored input");
};
verifyActorInputs = unchanged;
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
const apiEnvironmentReceipts = require("./api-environment-layers.cjs")({ root, launcher, rootEntries, apiFailures });
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
// The same producer and source owner now exercise the pending-output publisher's
// failure boundary. Direct Go emit tests own both noEmitOnError callback lanes;
// this actual public request uses false, where pending JavaScript can exist.
const nativeMain = path.join(nativeProject, "src/main.ts");
const nativeMainBytes = fs.readFileSync(nativeMain);
const rejectedOutput = path.join(nativeProject, "rejected-output");
const emitManifest = path.join(nativeProject, "manifest.json");
assert.equal(fs.existsSync(rejectedOutput), false);
assert.equal(fs.existsSync(emitManifest), false);
const directDriverEntry = rootEntries.find((entry) => entry.name === "shared-real-program-probe");
assert.ok(directDriverEntry);
const failedNativeOptions = JSON.parse(nativeConfiguration);
Object.assign(failedNativeOptions.compilerOptions, {
  declaration: true, declarationMap: true, noEmitOnError: false,
  outDir: "rejected-output", declarationDir: "rejected-output",
  plugins: [{ name: "go-driver-emit-plugin", transform: path.join(root, "descriptors/default.cjs"),
    fixtureSource: path.join(path.dirname(directDriverEntry.fixtureSource), "cmd/public-probe"), publicCommand: true }],
});
const previousDriverMode = process.env.TTSC_E2E_PUBLIC_PROBE_MODE;
// The raw driver dispatches linked hooks against its own loaded Program too.
// Automatic discovery must not retain the root bundle/map reporting epoch.
const driverAutomatic = JSON.parse(automaticManifestBytes);
delete driverAutomatic.ttsc.plugin.reportedFiles;
driverAutomatic.ttsc.plugin.reportedProgramSources = true;
driverAutomatic.ttsc.plugin.reportedDependencies = [];
const stderrDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "write");
let driverEmitStderr = "";
let driverEmitStatus;
const driverEmitBefore = receiptCount();
try {
  fs.writeFileSync(nativeMain, "export const value = class { private hidden = 1; };\n");
  fs.writeFileSync(nativeConfigFile, JSON.stringify(failedNativeOptions));
  fs.writeFileSync(automaticManifestFile, JSON.stringify(driverAutomatic));
  process.env.TTSC_E2E_PUBLIC_PROBE_MODE = "driver-emit";
  process.stderr.write = (chunk) => { driverEmitStderr += String(chunk); return true; };
  driverEmitStatus = runTtsc(["--cwd", nativeProject, "--emit"]);
  assert.equal(typeof driverEmitStatus, "number");
  assert.notEqual(driverEmitStatus, 0, driverEmitStderr);
  for (const expression of [/go-driver-emit-plugin: emit failed/, /native plugin .* failed/, /error/, /TS4094/, /declaration output is incomplete or skipped/])
    assert.match(driverEmitStderr, expression);
  assert.equal(fs.existsSync(rejectedOutput), false, "a Go emit error must discard pending JS before filesystem publication");
  assert.equal(fs.existsSync(emitManifest), false, "a failed emit must never reach the native host's manifest writer");
} finally {
  if (stderrDescriptor === undefined) delete process.stderr.write;
  else Object.defineProperty(process.stderr, "write", stderrDescriptor);
  if (previousDriverMode === undefined) delete process.env.TTSC_E2E_PUBLIC_PROBE_MODE;
  else process.env.TTSC_E2E_PUBLIC_PROBE_MODE = previousDriverMode;
  try { fs.writeFileSync(nativeMain, nativeMainBytes); }
  finally {
    try { fs.writeFileSync(nativeConfigFile, nativeConfiguration); }
    finally { fs.writeFileSync(automaticManifestFile, automaticManifestBytes); }
  }
}
assert.deepEqual(fs.readFileSync(automaticManifestFile), automaticManifestBytes, "the failed driver dispatch must restore the root reporting contributor");
const driverEmitAfter = receiptCount();
unchanged();
const registerBefore = receiptCount();
const rejectedEnv = { ...process.env };
for (const name of ["TTSX_RUNTIME_MANIFEST", "TTSX_RUNTIME_CACHE_DIR", "TTSX_RUNTIME_RUN_DIR", "TTSX_RUNTIME_RUNS_DIR"])
  delete rejectedEnv[name];
actorFacts.actors.rejection = { attempted: true, closed: false };
saveActor();
const rejected = spawnSync(process.execPath, [
  "--require", path.join(__dirname, "runtime-negative/preload.cjs"), process.env.TTSC_E2E_INSTALLED_TTSX,
  "--cwd", root, "--strict", "-P", "runtime-owned.json", "--no-plugins", "@tools/runtime-negative/args.txt", "tools/runtime-negative/script.js",
], { cwd: root, env: rejectedEnv, encoding: "utf8", windowsHide: true });
Object.assign(actorFacts.actors.rejection, { pid: rejected.pid, status: rejected.status, signal: rejected.signal, error: rejected.error ? String(rejected.error) : null,
  closed: !rejected.error && rejected.pid > 0 && (rejected.status !== null || rejected.signal !== null) });
saveActor();
if (rejected.error || rejected.signal !== null || rejected.status === null || !(rejected.pid > 0))
  throw new Error("rejection actor closure remained unresolved", { cause: rejected.error ?? new Error(JSON.stringify({ signal: rejected.signal, status: rejected.status, pid: rejected.pid })) });
assert.equal(rejected.error, undefined);
assert.equal(rejected.signal, null);
assert.equal(rejected.status, 2, rejected.stderr);
assert.match(rejected.stderr, /TS6133[^\r\n]*unused/, "the explicit diagnostic-project entry preserves its own unused-local error");
assert.ok(rejected.pid > 0);
try { process.kill(rejected.pid, 0); throw new Error("rejection actor closure remained unresolved"); }
catch (error) { if (error.code !== "ESRCH") throw error; }
const readonlyActive = process.env.TTSC_E2E_READONLY_DENIED === "1";
const rejectedLines = rejected.stdout.trim().split(/\r?\n/);
const dependencyDeliveryPrefix = "dependency entry ran";
assert.deepEqual(rejectedLines.filter((line) => line.startsWith(dependencyDeliveryPrefix)),
  ["dependency entry ran hello"], "the importing entry must deliver the dependency's authored value exactly once under its own diagnostic policy");
const responseLines = rejectedLines.filter((line) => !line.startsWith(dependencyDeliveryPrefix));
const cjsMainPrefix = "TTSC_CJS_MAIN:";
const cjsMainLines = rejectedLines.filter((line) => line.startsWith(cjsMainPrefix));
assert.equal(cjsMainLines.length, 1);
const cjsMain = JSON.parse(cjsMainLines[0].slice(cjsMainPrefix.length));
assert.equal(fs.realpathSync.native(cjsMain.argv1), fs.realpathSync.native(path.join(__dirname, "runtime-negative/readonly/src/main.ts")));
const { argv1: cjsArgv, ...cjsIdentity } = cjsMain;
assert.deepEqual(cjsIdentity, { main: true, cache: "object", shared: true }, "the existing typed CommonJS child must stay the main module under an actual import preload");
assert.equal(responseLines.filter((line) => !line.startsWith(cjsMainPrefix)).join("\n"), "Hello Class Foo\nHello Function getBar\nabc\nTTSC_RESPONSE_OPTIONAL:true\nTTSC_RESPONSE_JSX:<div>hello</div><b>world</b>\nread-only-ran\nHello Class Foo\nHello Function getBar\nabc\nTTSC_RESPONSE_OPTIONAL:false\nTTSC_RESPONSE_JSX:<div>hello</div><b>world</b>\nincluded-ran", "the two existing entry children must preserve complete decorator effects, opposite native response targets and automatic/forwarded preserved JSX");
assert.doesNotMatch(rejected.stdout, /(?:^|\r?\n)(?:ran|outside-ran)(?:\r?\n|$)/, "neither the refused JavaScript entry nor the excluded typed entry may execute");
assert.match(rejected.stderr, /-r requires a value/);
assert.match(rejected.stderr, /ttsx: entry not found:/);
assert.match(rejected.stderr, /missing-entry\.ts/);
for (const option of ["--project", "--no-plugins", "--strict", "@tools/runtime-negative/args.txt"])
  assert.ok(rejected.stderr.split(/\r?\n/).some((line) => line.includes("ttsx:") && line.includes(option)), "the actual JavaScript refusal must name " + option);
assert.match(rejected.stderr, /script\.js is JavaScript/);
assert.match(rejected.stderr, /TS6046/);
assert.match(rejected.stderr, /TS6133/);
// Native pretty diagnostics are relative to the explicitly selected owner's
// cwd. The refusal names that complete config owner independently.
const plainRejectedDiagnostics = rejected.stderr.replace(/\x1b\[[0-9;]*m/g, "");
assert.match(plainRejectedDiagnostics, /tools[\\/]configured-owners[\\/]diagnostic[\\/]tsconfig\.json/);
assert.match(plainRejectedDiagnostics, /src[\\/]index\.ts:[^\r\n]*TS6133[^\r\n]*unused/);
if (readonlyActive) {
  assert.match(rejected.stderr, /is not writable/);
  assert.ok(rejected.stderr.includes(process.env.TTSC_E2E_READONLY_ROOT));
  assert.match(rejected.stderr, /"include" or "files"/);
}
const rejectedObservation = JSON.parse(fs.readFileSync(path.join(__dirname, "runtime-negative/observed.json"), "utf8"));
assert.equal(typeof rejectedObservation.dependencyStatus, "number");
assert.equal(rejectedObservation.dependencyStatus, 2);
assert.equal(rejectedObservation.dependencyDeliveryStatus, 0);
const { dependencyStatus, dependencyDeliveryStatus, ...priorRejectionObservation } = rejectedObservation;
assert.deepEqual(priorRejectionObservation,
  { statuses: [2, 2], exitCode: 2, pid: rejected.pid,
    readonly: readonlyActive ? { skipped: false, statuses: [0, 2, 0] } : { skipped: true, statuses: [] },
    response: { statuses: [0, 0, 2] } });
assert.equal(receiptCount(), registerBefore, "frontend refusals and plugin-free readonly calls must not execute a context-reporting fixture contributor; this is not a raw compiler/Program count");
unchanged();
// The authored --cacheDir authority overrides the separate plugin-cache env.
// Its independently allocated path is supplied by the owning Runtime feature;
// an observed output path never serves as this placement expectation.
const explicitRuntimeCache = process.env.TTSC_E2E_RUNTIME_CLI_CACHE;
assert.equal(typeof explicitRuntimeCache, "string");
assert.equal(path.isAbsolute(explicitRuntimeCache), true);
const explicitOrphans = path.join(explicitRuntimeCache, "ttsx-orphan");
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
// An excluded source still owns its nearest config and uses checked root
// emission. The placement control must actually have no config owner.
const configlessDirectory = path.join(explicitRuntimeCache, "runtime-configless-placement");
const configlessPlacement = path.join(configlessDirectory, "runtime-placement.ts");
assert.equal(fs.existsSync(configlessDirectory), false);
fs.mkdirSync(configlessDirectory);
for (let ancestor = configlessDirectory; ; ancestor = path.dirname(ancestor)) {
  assert.equal(fs.existsSync(path.join(ancestor, "tsconfig.json")), false, "the placement input must not inherit an owning project");
  if (path.dirname(ancestor) === ancestor) break;
}
const configlessBytes = fs.readFileSync(path.join(__dirname, "runtime-placement.ts"));
fs.copyFileSync(path.join(__dirname, "runtime-placement.ts"), configlessPlacement);
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
let childJoined = false;
let descendantAdmission;
let descendantRelease;
let descendantJoin;
const descendantController = require("./runtime-owned-descendant.cjs");
const descendant = path.join(__dirname, "runtime-descendant");
let registerFailure;
try {
actorFacts.registerRestorationRequired = true;
saveActor();
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
  env.TTSC_E2E_CONFIGLESS_PLACEMENT = configlessPlacement;
  env.TEMP = env.TMP = env.TMPDIR = temporary;
  actorFacts.actors.registered = { attempted: true, closed: false };
  saveActor();
  registered = spawnSync(process.execPath,
    ["--require", path.join(launcher, "../register.js"), path.join(root, "tools/configured-owners/legacy/src/register-entry.tsx")],
    { cwd: root, env, encoding: "utf8", windowsHide: true });
  Object.assign(actorFacts.actors.registered, { pid: registered.pid, status: registered.status, signal: registered.signal, error: registered.error ? String(registered.error) : null,
    closed: !registered.error && registered.pid > 0 && (registered.status !== null || registered.signal !== null) });
  saveActor();
} finally {
  fs.unlinkSync(configuration);
}
childReport = fs.existsSync(path.join(descendant, "parent.json")) ? JSON.parse(fs.readFileSync(path.join(descendant, "parent.json"), "utf8")) : undefined;
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
  descendantAdmission = descendantController.request("registered", "ready");
  assert.equal(descendantAdmission.parent.pid, registered.pid);
  descendantController.request("registered", "parent-joined");
  const registerLines = registered.stdout.trim().split(/\r?\n/);
  assert.deepEqual(registerLines.slice(0, -1), ['TTSC_REGISTER_VIEW:<div>hello</div><b>world</b>', 'lowered', 'entry', 'TTSC_DECLARED_REGISTER:{"generated":42,"neighbor":43,"payload":42}']);
  const boundaryPrefix = "TTSC_INSTALLED_BOUNDARY_REGISTER:";
  assert.ok(registerLines.at(-1).startsWith(boundaryPrefix), registered.stdout);
  assert.deepEqual(JSON.parse(registerLines.at(-1).slice(boundaryPrefix.length)), boundaryExpected);
  const defaultAdded = lowerings(defaultOrphans).filter((name) => !defaultBefore.has(name));
  assert.equal(defaultAdded.length, 3, "default placement and the two configless installed targets each own one lowering");
  const loweredSources = defaultAdded.flatMap((name) => {
    const text = fs.readFileSync(path.join(defaultOrphans, name), "utf8");
    const inline = /sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)/.exec(text);
    assert.ok(inline, "each retained isolated emit must preserve its original source-map identity");
    return JSON.parse(Buffer.from(inline[1], "base64").toString("utf8")).sources;
  });
  const { fileURLToPath } = require("node:url");
  assert.deepEqual(loweredSources.map((source) => fs.realpathSync.native(fileURLToPath(source))).sort(), [
    configlessPlacement,
    path.join(boundaryRoot, "app/NODE_MODULES/boundary-no-config/index.cts"),
    path.join(boundaryRoot, "app/NODE_MODULES/boundary-no-config/esm.mts"),
  ].map((file) => fs.realpathSync.native(file)).sort());
  assert.deepEqual(fs.readFileSync(configlessPlacement), configlessBytes);
  assert.equal(fs.existsSync(path.join(configlessDirectory, "runtime-placement.js")), false);
  assert.equal(fs.existsSync(path.join(temporary, "ttsc-orphan")), false, "neither placement may retain its lowering in the temporary directory");
  assert.ok(childReport, "the actual registered parent must publish its owned child identity");
  assert.equal(childReport.parent, registered.pid);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(descendant, "ready.json"), "utf8")), { pid: childReport.child, manifest: null, run: null, runtime: null, runs: null });
  assert.equal(descendantController.request("registered", "live").live, true, "the authenticated original manifestless descendant must remain held for its lazy import");
  const owners = fs.existsSync(defaultRuns) ? fs.readdirSync(defaultRuns).flatMap((run) => fs.readdirSync(path.join(defaultRuns, run)).filter((name) => /^owner-.*\.json$/.test(name)).map((name) => JSON.parse(fs.readFileSync(path.join(defaultRuns, run, name), "utf8")))) : [];
  assert.equal(owners.some((owner) => owner.pid === childReport.child), false, "manifestless register must not invent an inherited generation owner");
  assert.equal(cleanDefault(), 0);
  assert.equal(fs.existsSync(defaultRuntime), false, "default clean must remove the unowned manifestless generation before the live descendant lazily rebuilds its typed input");
  descendantRelease = descendantController.request("registered", "release");
  descendantJoin = descendantController.request("registered", "joined");
  childJoined = descendantJoin.retired;
  assert.equal(descendantJoin.completion.value, "descendant-ready", JSON.stringify(descendantJoin));
  assert.equal(fs.readFileSync(path.join(descendant, "result"), "utf8"), "descendant-ready");
  assert.equal(cleanDefault(), 0);
  assert.equal(fs.existsSync(defaultRuntime), false, "default clean must remove the completed registered run");
} catch (error) { descendantFailures.push(error); }
finally {
  if (!childJoined) try {
    if (!descendantRelease) descendantController.request("registered", "abort");
    descendantJoin = descendantController.request("registered", "joined");
    childJoined = descendantJoin.retired;
  } catch (error) { descendantFailures.push(new Error("registered descendant closure remained unresolved", { cause: error })); }
}
if (descendantFailures.length) throw new AggregateError(descendantFailures, "registered descendant live/lazy/finished cleanup");
} catch (cause) { registerFailure = cause; }
finally {
  const restorationFailures = [];
  if (!childJoined) restorationFailures.push(new Error("register reporting epoch retained because its descendant closure is unresolved"));
  else {
    try { fs.writeFileSync(registerBaseFile, registerBaseBytes); } catch (cause) { restorationFailures.push(cause); }
    try { fs.writeFileSync(automaticManifestFile, automaticManifestBytes); } catch (cause) { restorationFailures.push(cause); }
    try {
      assert.deepEqual(fs.readFileSync(configlessPlacement), configlessBytes);
      fs.unlinkSync(configlessPlacement);
      fs.rmdirSync(configlessDirectory);
    } catch (cause) { restorationFailures.push(cause); }
  }
  if (restorationFailures.length)
    throw new AggregateError([...(registerFailure === undefined ? [] : [registerFailure]), ...restorationFailures], "registered preparation and independent restoration failures");
  actorFacts.registerRestored = true;
  saveActor();
}
if (registerFailure !== undefined) throw registerFailure;
assert.deepEqual(fs.readFileSync(automaticManifestFile), automaticManifestBytes, "register reporting must restore the root discovery contributor after its descendant closes");
unchanged();
actorFacts.inputsRestored = true;
saveActor();
const registerCompletedAt = new Date().toISOString();
fs.writeFileSync(path.join(__dirname, "runtime-declared-observed.json"), JSON.stringify({ apiEnvironmentBefore: apiEnvironmentReceipts.before, apiEnvironmentAfter: apiEnvironmentReceipts.after, apiFailures: apiFailures.map((error) => ({ name: error.message, detail: String(error.cause), stack: error.cause?.stack })), produced: [...seed.keys()].map((file) => path.relative(artifacts, file)).sort(), nativeEmitBefore, nativeEmitAfter, driverEmitBefore, driverEmitAfter, driverEmitStatus, driverEmitStderr, rejectedOutputAbsent: !fs.existsSync(rejectedOutput), emitManifestAbsent: !fs.existsSync(emitManifest), registerStatus: registered.status, registerPid: registered.pid, descendantPid: childReport.child, descendantResult: fs.readFileSync(path.join(descendant, "result"), "utf8"), descendantClosed: childJoined, descendantAdmission, descendantRelease, descendantJoin, registerBefore, registerAfter: receiptCount(), registerCompletedAt, mainEpochOwner: process.pid }));

// Registration's original snapshots and receipt endpoint precede this separate
// main-source epoch. The outer owner restores exact original base/marker bytes
// only after this main and every original descendant have actually joined.
const mainOptions = JSON.parse(registerBaseBytes);
mainOptions.compilerOptions.plugins = mainOptions.compilerOptions.plugins.map(registerReports);
const mainAutomatic = JSON.parse(automaticManifestBytes);
mainAutomatic.ttsc.plugin = registerReports(mainAutomatic.ttsc.plugin);
actorFacts.mainReportingAttempted = true;
saveActor();
fs.writeFileSync(registerBaseFile, JSON.stringify(mainOptions));
fs.writeFileSync(automaticManifestFile, JSON.stringify(mainAutomatic));
} catch (cause) { actorFailure = cause; }
finally {
  if (!actorFacts.mainReportingAttempted && verifyActorInputs) {
    try { verifyActorInputs(); actorFacts.inputsRestored = true; }
    catch (cause) { receiptFailures.push(cause); }
  }
  actorFacts.finished = true;
  actorFacts.success = actorFailure === undefined && receiptFailures.length === 0;
  actorFacts.semanticErrors = [actorFailure, ...receiptFailures].filter((cause) => cause !== undefined).map(String);
  saveActor();
}
if (actorFailure !== undefined || receiptFailures.length)
  throw new AggregateError([...(actorFailure === undefined ? [] : [actorFailure]), ...receiptFailures], "declared runtime observations and receipt publication");
