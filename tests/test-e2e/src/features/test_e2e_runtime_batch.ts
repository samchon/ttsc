import { FileSystemIterator, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BatchWorkspace } from "../batch/BatchWorkspace";
import { assertRuntimeCliCorpus } from "../batch/runtimeCliCorpus";
import { assertRuntimeNodeCorpus } from "../batch/runtimeNodeCorpus";
import { assertRuntimeNormalPopulation } from "../batch/runtimeNormalPopulation";

/**
 * Verifies one public runtime loads the shared transformed graph.
 *
 * Native string decoding, resolved JSON and unchanged neighboring values reach
 * one real ttsx entry. Unremoved configured discard calls throw, so successful
 * values cannot hide missing stripping. Every value belongs to this one graph.
 *
 * 1. Capture the source/config bytes and invoke the public ttsx entry once.
 * 2. Compare its one actual JSON payload against all original literal rows.
 * 3. Require source/config preservation and absent adjacent JavaScript output.
 *
 * The two configured dependency families have incompatible compiler modes: one default-ESM/Bundler owner with a contrary CommonJS manifest supplies all extensionless ESM nodes, while one empty CommonJS/legacy-decorator owner supplies one source fallback containing two independent method decorators. Same-basename identity selection is owned by exact EmitOwnershipIndex/OwnedProjectSource units and the existing root ownership graph rather than additional legacy source requests. Both are requested within the existing runtime, with no per-case project or launch. Native owner preparation and fallback are additional explicit Program costs; the outer runtime count alone does not certify total independent experimentation.
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsx process must return status0 and exactly one full labeled payload with contract42, copied JSON42/retained and all661 native JSX string values. Configured discard.call and logger.trace("drop") would throw if the actual strip transform or custom rule were missing; the retained default-only log distinguishes the contrary root config. Both standard decorator modules additionally require their literal must-be-stripped console.warn to be absent from actual stderr while retaining the exact class/method effects.
 * @evidence contracts/testing.md#independent-expectations The source's authored42/retained values and pre-print UTF-16 rows establish expectations, not the runtime's own output. Exact original input bytes establish nonmutation.
 * @evidence contracts/testing.md#distinguishing-cases Quoted/expression/ordinary JSX strings, JSON alias versus unchanged neighbor and configured throwing call versus retained console.info share the same module graph. The same Program preserves an enum through direct/barrel CommonJS-to-ESM loading with named/default identity, erased interface absence, repeated import identity, one source effect and live default getter42-to43; no extra producer/profile loop is introduced. Static if(false) reexport metadata yields an undefined namespace slot while the real CommonJS object owns no hidden property; template-only ghost metadata yields neither slot nor value. Both throwing helpers must remain inert. The existing ESNext owner additionally imports a literal node_modules CommonJS package and a miscased Node_Modules project source; their different physical parents prevent a case-insensitive filesystem from aliasing the two directory spellings.
 * @evidence contracts/testing.md#execution-ownership This selected function invokes TestProject.spawn exactly once. Every remaining operation reads bytes or compares literal values; it invokes no legacy test or profile launcher.
 * @evidence contracts/e2e.md#necessary-boundary Public ttsx connects native transforms, source publication and actual Node loading. Go rule units cannot establish the loaded graph's observed values or source preservation.
 * @evidence contracts/e2e.md#shared-execution One consumer and its runtime process carry the value graph, two source-race loads and installed clean dispatch. One actual exited lock-holder child transfers the dead-owner connection; default and explicit clean run in this same runtime without another CLI launcher. Common preparation's real Go metadata/build/smoke and isolated emit children remain disclosed internal costs, not standalone source projects or one-Program certification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Native errors are outside the positive tsconfig population. The excluded orphan changes during its actual compiler read, restores original bytes before the second require and finally, and its environment authority restores before the main graph. The main source/config remain immutable; synchronous process error/signal/null status fails and unknown closure retains the common owner.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the native factory value matrix and combined utility alias/strip/runtime observations in one real loaded graph. The standard class/method warning-removal composition and original ESNext member-initialization effects run in both .mts/.cts modules in the same upfront Program; the contrary module-package .cts value is loaded alongside the .mts public entry. Source dirname, imported class root and both asset reads preserve their independent physical identities. The export population additionally observes real tslib IIFE reexports, inert throwing/template negatives, computed dynamic default exports, live default getters and bare-package versus project basename ownership, all from upfront inputs in the same host. Direct commonjs preparation/metadata and emit ownership units own their detailed portable distinctions. Dependency profile recipes are not repeated; isolated orphan lowering and other compiler-mode/lifetime transitions remain outside this population.
 */
export async function test_e2e_runtime_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  if (!workspace.installationOnly)
    for (const receipt of [workspace.factoryContextProbe, workspace.factoryEsmContextProbe])
      assert.ok(path.relative(workspace.root, receipt).startsWith(".." + path.sep), "factory observation outputs must stay outside compiler input membership");
  const config = fs.readFileSync(path.join(workspace.root, "tsconfig.json"));
  const source = fs.readFileSync(path.join(workspace.root, "src/runtime.mts"));
  const baseline = fs.readdirSync(workspace.root).filter((name) => name !== "node_modules" && name !== "program-runs.bin" && name !== "native-context.jsonl" && name !== "native-config-paths.jsonl" && name !== "native-program-paths.jsonl" && name !== "native-case-policy.jsonl").sort();
  const receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
  const configuredRoot = path.join(workspace.root, "tools/configured-owners");
  const configuredInputs = await FileSystemIterator.read(configuredRoot);
  const normalRoot = path.join(workspace.root, "src/runtime-corpus/normal-population");
  const normalInputs = await FileSystemIterator.read(normalRoot);
  const standardRoot = path.join(workspace.root, "src/runtime-corpus/standard");
  const standardInputs = await FileSystemIterator.read(standardRoot);
  const runtimeOwnerConfig = fs.readFileSync(path.join(workspace.root, "runtime-owned.json"));
  let result: ReturnType<typeof TestProject.spawn>;
  const base = path.join(workspace.root, "runtime-base.json");
  const selected = workspace.installationOnly ? [] : [
    "-P", "runtime-owned.json",
    "--outDir", "distx", "--declaration", "--declarationDir", "typesx",
    "--incremental", "--tsBuildInfoFile", "state/run.tsbuildinfo", "--outFile", "bundle.js",
    "--noEmit", "--emitDeclarationOnly", "--target", "es2019", "@runtime-args.txt",
    "--sourceMap", "false", "--inlineSourceMap",
    "-r", "./runtime-map-diagnostics.cjs",
    "-r", "./tools/native-source-borrower.cjs",
    "-r", "./tools/runtime-clean-flow.cjs",
  ];
  if (!workspace.installationOnly) fs.renameSync(path.join(workspace.root, "tsconfig.json"), base);
  try {
    result = TestProject.spawn(process.execPath, [workspace.installedTtsx, ...selected, workspace.installationOnly ? "src/installation-runtime.ts" : "src/runtime.mts", ...(workspace.installationOnly ? [] : ["--config", "x", "--port", "3", "--help"])], {
      cwd: workspace.root,
      env: { TTSC_CACHE_DIR: workspace.cache, TTSC_BINARY: undefined, TTSC_TSGO_BINARY: undefined,
        TTSC_E2E_SOURCE_PUBLICATION: workspace.sourcePublication?.binary, TTSC_E2E_ORPHAN_COMPILER: TestProject.TSGO_BINARY,
        TTSC_E2E_INSTALLED_TTSX: workspace.installedTtsx },
    });
  } finally {
    if (!workspace.installationOnly) fs.renameSync(base, path.join(workspace.root, "tsconfig.json"));
  }
  assert.deepEqual(fs.readdirSync(workspace.root).filter((name) => name !== "node_modules" && name !== "program-runs.bin" && name !== "native-context.jsonl" && name !== "native-config-paths.jsonl" && name !== "native-program-paths.jsonl" && name !== "native-case-policy.jsonl").sort(), baseline);
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /TTSC_TEST_RUNTIME_BARREL_LOADED|TTSC_TEST_PATTERN_RUNTIME_LOADED/, "both bare and wildcard ttsc export conditions must avoid the throwing runtime entries");
  assert.doesNotMatch(result.stderr, /must-be-stripped/, "strip must compose with both native standard-decorator modules");
  const payload = BatchWorkspace.readPayload(result.stdout);
  if (workspace.installationOnly) {
    assert.equal((payload as { answer: unknown }).answer, 42);
    BatchWorkspace.assertValues((payload as { values: unknown }).values, workspace.expected);
  } else {
  BatchWorkspace.assertResult(payload, workspace.expected, true);
  const nativeReceipts = BatchWorkspace.readContextReceipts(workspace).slice(receiptOffset);
  BatchWorkspace.assertContextReceipts(nativeReceipts);
  assert.deepEqual(nativeReceipts.filter((receipt) => receipt.name === "native-auto-discovery"), [
    { name: "native-auto-discovery", operation: "identity", prefix: null, suffix: null },
  ], "the direct-dependency marker must admit its native entry without an explicit configured transform");
  const descriptorFilename = fs.realpathSync.native(path.join(workspace.root, "descriptors/context.cjs"));
  assert.deepEqual(JSON.parse(fs.readFileSync(workspace.factoryContextProbe, "utf8")), {
    filename: descriptorFilename, dirname: path.dirname(descriptorFilename),
    ambientFilename: descriptorFilename, ambientDirname: path.dirname(descriptorFilename),
  });
  const esmDescriptorFilename = fs.realpathSync.native(path.join(workspace.root, "descriptors/esm/src/index.ts"));
  assert.deepEqual(JSON.parse(fs.readFileSync(workspace.factoryEsmContextProbe, "utf8")), {
    filename: esmDescriptorFilename, dirname: path.dirname(esmDescriptorFilename),
    ambientFilename: "undefined", ambientDirname: "undefined",
  });
  assertRuntimeCliCorpus((payload as { cliPolicyRuntime: unknown }).cliPolicyRuntime);
  const cleanObservation = JSON.parse(fs.readFileSync(path.join(workspace.root, "tools/runtime-clean-flow/observed.json"), "utf8"));
  assert.deepEqual({ ...cleanObservation, seed: undefined }, {
    defaultStatus: 0, explicitStatus: 0, deadHolderRecovered: true, legacyKept: true, malformedKept: true,
    explicitRemoved: true, seed: undefined,
  });
  assert.equal(cleanObservation.seed.status, 0);
  assert.equal(cleanObservation.seed.signal, null);
  assert.ok(cleanObservation.seed.pid > 0);
  assert.match(result.stdout, /ttsc: kept [^\r\n]*legacy: a run that may still be in progress owns it/);
  assert.match(result.stdout, /ttsc: kept [^\r\n]*unknown: a run that may still be in progress owns it/);
  assert.doesNotMatch(result.stdout, /no cache directories found/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workspace.root, "tools/source-publication/runtime-borrower.json"), "utf8")),
    { first: "two", second: "one", nativeMutation: true }, "the actual published default-cache executable is consumed within this runtime and cannot poison the restored source key");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workspace.root, "tools/source-publication/runtime-identity.json"), "utf8")),
    { first: "lowered", warm: "lowered", warmMarker: true, rewritten: "lowered", rewrittenMarker: false });
  assertRuntimeNodeCorpus((payload as { nodeCompatible: unknown }).nodeCompatible);
  assertRuntimeNormalPopulation((payload as { normalPopulation: unknown }).normalPopulation);
  assert.deepEqual(await FileSystemIterator.read(normalRoot), normalInputs, "all seven normal value/edge contributions must keep their source tree unchanged and contain no adjacent emitted files");
  assert.deepEqual(await FileSystemIterator.read(standardRoot), standardInputs, "both requested decorated index sources and their same-basename helper must remain unchanged without adjacent emits");
  assert.deepEqual(fs.readFileSync(path.join(workspace.root, "runtime-owned.json")), runtimeOwnerConfig);
  assert.deepEqual((payload as { exportPopulation: unknown }).exportPopulation, {
    inert: { actual: [17, 17], before: [42, 42], after: 43, inlineText: '\n__exportStar(require("./ghost"), exports);\n', memberText: '\ntslib_1.__exportStar(require("./ghost"), exports);\n',
      hidden: { namespaceOwn: true, namespaceValueType: "undefined", defaultOwn: false, defaultValueType: "undefined" },
      ghost: { namespaceOwn: false, namespaceValueType: "undefined", defaultOwn: false, defaultValueType: "undefined" },
      arithmetic: true, decorators: "Hello Class Foo\nHello Function getBar\nabc" },
    dynamic: { actual: [17, 17], computed: 42, decorators: "Hello Class Foo\nHello Function getBar\nabc" },
    collision: "project:package",
    lowering: "42:OK:7",
    enums: { value: [42, 42], identity: true, typeAbsent: true, actual: [17, 17], before: [42, 42, 42], after: 43, repeated: true, loads: 1, decorators: "Hello Class Foo\nHello Function getBar\nabc" },
  });
  assert.deepEqual((payload as { configuredOwners: unknown }).configuredOwners, {
    esnext: ["hello-workspace", "configured-esnext", "derived-from-target"], legacy: ["arguments=3", "dep-a:3", "dep-b:3"],
    wholeProject: { wrapped: 7, unimportedEmitted: true },
    declaredOutputs: ["inside", "extra"],
    classification: "cjs-dependency|esm-by-project",
    moduleValues: { enumRuntime: "Low-2", namespaceRuntime: "repeated-3" },
  });
  assert.deepEqual(await FileSystemIterator.read(configuredRoot), configuredInputs, "both existing native owner paths must keep all source bytes and declared output trees untouched");
  const nativeFrames = (payload as { nativeFrames: unknown }).nativeFrames;
  assert.ok(Array.isArray(nativeFrames));
  assert.equal(nativeFrames.length, 2);
  // The one actual Runtime receives inlineSourceMap after explicitly clearing
  // the shared external-map setting. These are Node-consumed native frames,
  // rather than JSON map metadata or a synthetic source API map.
  const nativeMapLines = result.stdout.split(/\r?\n/).filter((line) => line.startsWith("TTSC_RUNTIME_MAPS:"));
  assert.equal(nativeMapLines.length, 1, "the existing Runtime child must publish its own Node map diagnostics exactly once");
  const nativeFrameDiagnostic = JSON.stringify({ frames: nativeFrames, maps: JSON.parse(nativeMapLines[0]!.slice("TTSC_RUNTIME_MAPS:".length)) });
  assert.match(nativeFrames[0], /inside\.cts:5:\d+/, nativeFrameDiagnostic);
  assert.match(nativeFrames[1], /outside\.cts:5:\d+/, nativeFrameDiagnostic);
  assert.deepEqual((payload as { requireBindings: unknown }).requireBindings, ["@lib/message", "local:@lib/message", "imported:@lib/message", "ok", "ok"]);
  const mixed = (payload as { mixedRuntime: unknown }).mixedRuntime;
  assert.deepEqual(mixed, {
    contraryCommonjs: "cts-runner-ok",
    mtsImport: "mts-runner-ok",
    dual: "42:7:esm-ok",
    sameNamedOwnership: "a,b,a,b,tools",
    rawPackageOwnership: "tools",
    rawLowering: "42:OK:7",
    standardEsm: "Hello Class Foo\nHello Function getBar\nabc",
    standardCommonjs: "Hello Class Foo\nHello Function getBar\nabc",
    memberEsm: "11 method\nstatic:run,class:Foo,field:#value,accessor:count",
    memberCommonjs: "11 method\nstatic:run,class:Foo,field:#value,accessor:count",
    adapterFactories: ["function", "function", "function", "function"],
    answers: [42, 42],
    requestedSource: [1, 1],
    proposalValue: 42,
    startupMarkers: ["ran", "entry-ran", "ENTRY", "explicit-runner-project"],
    mainMessage: "main:value",
    optionalChainPreserved: true,
  });
  const locations = (payload as { sourceLocations: { marker: string; template: string; directory: string; classRoot: string } }).sourceLocations;
  assert.equal(locations.marker, "source-relative-dirname");
  assert.equal(locations.template, "dirname-preserved");
  assert.equal(fs.realpathSync.native(locations.directory), fs.realpathSync.native(path.join(workspace.root, "src")));
  assert.equal(fs.realpathSync.native(locations.classRoot), fs.realpathSync.native(workspace.root));
  const helpers = (payload as { publicHelpers: unknown }).publicHelpers;
  assert.deepEqual(helpers, { memoryFile: "export const value = 1;\n", decoded: { value: 1 }, scoped: "@scope/package", builtin: null });
  }
  assert.deepEqual(fs.readFileSync(path.join(workspace.root, "tsconfig.json")), config);
  assert.deepEqual(fs.readFileSync(path.join(workspace.root, "src/runtime.mts")), source);
  assert.equal(fs.existsSync(path.join(workspace.root, "src/runtime.mjs")), false);
}








