import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { unplugin } from "../../../../../packages/unplugin/src/core/unplugin";
import { sharedBuildTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/sharedBuildTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { createBuildWatchFile } from "../../../../../packages/unplugin/src/core/bridge/createBuildWatchFile";
import { hostToolDirectory } from "../../../../../packages/unplugin/src/core/bridge/hostToolDirectory";
import { projectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { registerProjectRecord } from "../../../../../packages/unplugin/src/core/bridge/registerProjectRecord";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { notifyWatchInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyWatchInputs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies build loader callbacks receive the project record alone.
 *
 * Actual raw adapter transform callbacks consume a literal already-observed
 * generation from the public shared cache. No producer, compiler or loader host
 * is substituted, and the expected output is authored consumer data.
 *
 * @evidence contracts/testing.md#behavioral-verification Real webpack/Rspack raw transform callbacks serve the exact cached output, retain its promise and hand one persisted project record to addDependency on first and repeated delivery; addMissingDependency/addContextDependency receive nothing. The record carries native config/declaration bytes, an absent candidate predicate, an empty listed directory predicate and project membership. Actual createBuildWatchFile separately routes Farm module/input pairs, webpack/Rspack input-only loader dependencies and generic fallback calls with original receivers and exact callback errors. A native configured-root link over a physical module connects hostToolDirectory/projectRecordFile, actual notifyWatchInputs record persistence and registerProjectRecord to the Farm channel without a Farm private cache.
 * @evidence contracts/testing.md#independent-expectations One module-level record dependency rather than the individual source/config paths follows the build-host handoff contract. Exact literal output, promise identity, empty alternate channels and independently present native input keys distinguish wrong handoff or loss of caching. Node SHA-256 supplies the declaration hash; deliberately absent candidate and empty native directory fix their literal predicates. Record bytes stay identical across repeated handoff. Authored exact module/input strings and callback ledgers independently fix channel arguments. A native-context getter counted once and distinct selected/replacement loader objects distinguish factory selection from per-call method lookup; Error identity and context identity are independent literals. Native lstat/realpath independently establish the configured-root alias; Node SHA-256 of the lexical linked config determines its expected record filename, while persisted selected-config spelling/input key and exact physical target distinguish relocation or canonicalization.
 * @evidence contracts/testing.md#distinguishing-cases Both raw compiler callback families use a nonwatching context with the same settled input; each is isolated by its native fixture/options key. Additional factory rows contrast present loader versus absent native/absent loader fallback, Farm two-argument association versus loader/generic input-only calls, repeated registration, retained loader selection, changed methods and error propagation. The linked configured-root row distinguishes physical module spelling from lexical config/record spelling and repeats the same persisted handoff without changing bytes. Real watching streams, automatic Farm wrapper-root selection and installed host cache invalidation remain external boundaries.
 * @evidence contracts/testing.md#execution-ownership This source unit calls unplugin.raw transform and shutdown callbacks in process over public consumer cache input. It restores cwd and resets both cache owners in finally; no Go peer, binary, build, watcher or native framework process is used. The factory rows use authored native-context callback shapes with unrelated compiler fields opaque; they exercise the actual production-used channel operation, not installed webpack/Rspack/Farm/Rollup hosts. They do not certify TP/Bun loaders, registration assembly, project-record bridge lifetime or native watch receipt. The linked-root row creates and removes one native alias in finally and uses actual record creation/handoff operations with no bridge, native backend or compiler. It does not certify that a Farm transform wrapper automatically chose that configured root.
 */
export async function test_build_loader_callbacks_hand_over_only_the_project_record(): Promise<void> {
  for (const framework of ["webpack", "rspack"] as const) {
    const fixture = createCachedDeliveryUnitFixture();
    const root = path.dirname(path.dirname(fixture.file));
    const config = path.join(root, "tsconfig.json");
    const declaration = path.join(root, "node_modules", "typed", "index.d.ts");
    const candidate = path.join(root, "node_modules", "typed", "preferred.d.ts");
    const listed = path.join(root, "node_modules", "@types", "empty");
    fs.mkdirSync(path.dirname(declaration), { recursive: true });
    fs.mkdirSync(listed, { recursive: true });
    fs.writeFileSync(declaration, "export interface Shared { value: number }\n");
    assert.equal(fs.existsSync(candidate), false);
    assert.deepEqual(fs.readdirSync(listed), []);
    const digest = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    const declarationHash = digest(declaration);
    const result = {
      ...fixture.good.result,
      graph: {
        edges: { "src/main.ts": ["node_modules/typed/index.d.ts"] },
        globals: ["node_modules/@types/empty"], configs: [],
        candidates: { "src/main.ts": ["node_modules/typed/preferred.d.ts"] },
        resolutionInputs: ["node_modules/@types/empty"],
        inputHashes: { "src/main.ts": digest(fixture.file), "node_modules/typed/index.d.ts": declarationHash },
        inputRealpaths: { "src/main.ts": fs.realpathSync.native(fixture.file), "node_modules/typed/index.d.ts": fs.realpathSync.native(declaration) },
        inputObservations: {
          "node_modules/typed/preferred.d.ts": { fileExists: false },
          "node_modules/@types/empty": { stat: "directory" as const, accessibleEntries: { directories: [], files: [] } },
        },
      },
      hostInputs: [config], hostInputHashes: { [config]: digest(config) },
      hostInputRealpaths: { [config]: fs.realpathSync.native(config) },
    };
    const observed = { ...fixture.good, result };
    const state = envelopeDerivation(observed);
    const snapshot = collectProjectInputSnapshot(root, state.identityContext, DEFAULT_FILESYSTEM_OPERATIONS,
      undefined, { policy: observed.membershipPolicy });
    assert.equal(snapshot.complete, true);
    observed.inputHashes = snapshot.hashes;
    observed.projectDirectories = snapshot.projectDirectories;
    const externalPaths = selectExternalInputPaths({ projectRoot: root, result,
      membershipPolicy: observed.membershipPolicy, filesystem: DEFAULT_FILESYSTEM_OPERATIONS });
    const external = captureExternalInputSnapshot(observed, externalPaths, undefined);
    assert.equal(external.complete, true);
    observed.externalInputPaths = externalPaths;
    observed.externalInputHashes = external.hashes;
    observed.externalInputRealpaths = external.realpaths;
    observed.externalInputObservations = external.observations;
    const universal = captureUniversalHostInputValidation(observed, fixture.file);
    assert.ok(universal.validation);
    observed.hostInputValidation = universal.validation;
    const previous = process.cwd();
    const raw = unplugin.raw(fixture.options, { framework, [framework]: { compiler: {} } } as never);
    const shared = sharedBuildTransformCache(JSON.stringify(fixture.options));
    const generation = Promise.resolve(observed);
    shared.cache.set(fixture.key, generation);
    const dependencies: string[] = [];
    const missing: string[] = [];
    const directories: string[] = [];
    let shutdown: (() => void) | undefined;
    const compiler = {
      watchMode: false,
      options: { module: { rules: [] } },
      hooks: {
        done: { tap: () => undefined },
        shutdown: { tap: (_name: string, callback: () => void) => { shutdown = callback; } },
      },
    };
    const register = raw.webpack ?? raw.rspack;
    (register as (compiler: unknown) => void)(compiler);
    const context = {
      addWatchFile: () => assert.fail("build loader must use its module dependency channel"),
      getNativeBuildContext: () => ({
        framework, compiler,
        loaderContext: {
          addDependency: (file: string) => dependencies.push(file),
          addMissingDependency: (file: string) => missing.push(file),
          addContextDependency: (file: string) => directories.push(file),
        },
      }),
    };
    try {
      process.chdir(root);
      const transform = raw.transform as (this: unknown, source: string, id: string) => Promise<{ code: string } | undefined>;
      const output = await transform.call(context, fixture.source, fixture.file);
      assert.equal(output?.code, fixture.code);
      assert.equal(shared.cache.get(fixture.key), generation);
      assert.equal(dependencies.length, 1);
      assert.deepEqual(missing, []);
      assert.deepEqual(directories, []);
      assert.ok(path.isAbsolute(dependencies[0]!));
      assert.notEqual(dependencies[0], fixture.file);
      assert.notEqual(dependencies[0], path.join(root, "tsconfig.json"));
      const record = readProjectRecordFile(dependencies[0]!);
      assert.ok(record);
      assert.equal(record.root, root);
      assert.equal(record.tsconfig, path.join(root, "tsconfig.json"));
      assert.ok(Object.prototype.hasOwnProperty.call(record.inputs, path.join(root, "tsconfig.json")));
      assert.deepEqual(record.inputs[declaration]!.state, { codec: "graph", hash: declarationHash,
        realpath: fs.realpathSync.native(declaration) });
      assert.equal(record.inputs[candidate]!.missing, true);
      assert.deepEqual(record.inputs[candidate]!.state, { codec: "predicates", observation: { fileExists: false } });
      assert.deepEqual(record.inputs[listed]!.state, { codec: "predicates",
        observation: { stat: "directory", accessibleEntries: { directories: [], files: [] } } });
      assert.ok(record.membership);
      assert.ok(record.membership.directories.includes(root));
      const recordBytes = fs.readFileSync(dependencies[0]!, "utf8");
      assert.equal((await transform.call(context, fixture.source, fixture.file))?.code, fixture.code);
      assert.deepEqual(dependencies, [dependencies[0], dependencies[0]]);
      assert.deepEqual(missing, []);
      assert.deepEqual(directories, []);
      assert.equal(shared.cache.get(fixture.key), generation);
      assert.equal(fs.readFileSync(dependencies[0]!, "utf8"), recordBytes);
    } finally {
      process.chdir(previous);
      resetTtscTransformCache(shared.cache);
      shutdown?.();
      fixture.dispose();
    }
  }
  const delivered = path.resolve("/authored/build/source.ts");
  const input = path.resolve("/authored/build/record.json");
  for (const framework of ["webpack", "rspack"] as const) {
    const calls: [string, string][] = [];
    const loader = {
      addDependency: function (this: unknown, file: string): void {
        assert.equal(this, loader);
        calls.push(["original", file]);
      },
      addMissingDependency: () => assert.fail("missing channel is not module registration"),
      addContextDependency: () => assert.fail("directory channel is not module registration"),
    };
    let currentLoader = loader;
    let loaderLookups = 0;
    const native = { framework, compiler: {}, compilation: {}, get loaderContext() {
      loaderLookups++;
      return currentLoader;
    } };
    const context = { addWatchFile: () => assert.fail("present loader must own registration") };
    const selected = createBuildWatchFile(context, native as unknown as Parameters<typeof createBuildWatchFile>[1], delivered);
    assert.equal(selected.loaderContext, loader);
    assert.equal(loaderLookups, 1);
    selected.addWatchFile(input);
    currentLoader = { ...loader, addDependency: () => assert.fail("factory must retain its selected loader") };
    selected.addWatchFile(input);
    loader.addDependency = function (this: unknown, file: string): void {
      assert.equal(this, loader);
      calls.push(["changed-method", file]);
    };
    selected.addWatchFile(input);
    assert.deepEqual(calls, [["original", input], ["original", input], ["changed-method", input]]);
    const failure = new Error(framework + " registration failure");
    loader.addDependency = () => { throw failure; };
    assert.throws(() => selected.addWatchFile(input), (error) => error === failure);
    assert.equal(loaderLookups, 1, "registration does not reselect the loader context");
  }
  const farmCalls: [string, string][] = [];
  const farmContext = {
    addWatchFile: function (this: unknown, file: string, watched: string): void {
      assert.equal(this, farmContext);
      farmCalls.push([file, watched]);
    },
  };
  const farmNative = { framework: "farm" as const, context: farmContext };
  const farm = createBuildWatchFile({ addWatchFile: () => assert.fail("Farm must associate its module") }, farmNative as unknown as Parameters<typeof createBuildWatchFile>[1], delivered);
  assert.equal(farm.loaderContext, undefined);
  farm.addWatchFile(input);
  assert.deepEqual(farmCalls, [[delivered, input]]);
  const farmFailure = new Error("Farm registration failure");
  farmNative.context = { addWatchFile: function (this: unknown): void {
    assert.equal(this, farmNative.context);
    throw farmFailure;
  } };
  assert.throws(() => farm.addWatchFile(input), (error) => error === farmFailure);
  for (const framework of ["rollup-fallback", "webpack", "rspack"] as const) {
    const calls: string[] = [];
    const context = { addWatchFile: function (this: unknown, file: string): void {
      assert.equal(this, context);
      calls.push(file);
    } };
    const native = framework === "rollup-fallback" ? undefined : { framework, compiler: {}, compilation: {}, loaderContext: undefined };
    const fallback = createBuildWatchFile(context, native as unknown as Parameters<typeof createBuildWatchFile>[1], delivered);
    assert.equal(fallback.loaderContext, undefined);
    fallback.addWatchFile(input);
    fallback.addWatchFile(input);
    assert.deepEqual(calls, [input, input]);
    const failure = new Error(framework + " fallback failure");
    context.addWatchFile = function (this: unknown): void {
      assert.equal(this, context);
      throw failure;
    };
    assert.throws(() => fallback.addWatchFile(input), (error) => error === failure);
  }
  const linkedFixture = createCachedDeliveryUnitFixture();
  const physicalRoot = fs.realpathSync.native(path.dirname(path.dirname(linkedFixture.file)));
  const aliasParent = TestProject.tmpdir("ttsc-farm-record-alias-");
  const configuredRoot = path.join(aliasParent, "configured-root");
  const linkedConfig = path.join(configuredRoot, "tsconfig.json");
  try {
    fs.symlinkSync(physicalRoot, configuredRoot, process.platform === "win32" ? "junction" : "dir");
    assert.equal(fs.lstatSync(configuredRoot).isSymbolicLink(), true);
    assert.equal(fs.realpathSync.native(configuredRoot), physicalRoot);
    assert.equal(fs.realpathSync.native(linkedConfig), fs.realpathSync.native(path.join(physicalRoot, "tsconfig.json")));
    const result = { ...linkedFixture.good.result,
      hostInputs: [linkedConfig],
      hostInputHashes: { [linkedConfig]: createHash("sha256").update(fs.readFileSync(linkedConfig)).digest("hex") },
      hostInputRealpaths: { [linkedConfig]: fs.realpathSync.native(linkedConfig) },
    };
    const cached = { ...observeValidationUnitGeneration(physicalRoot, result),
      tsconfig: linkedConfig, membershipPolicy: readProjectMembershipPolicy(linkedConfig) };
    const tool = hostToolDirectory(configuredRoot);
    assert.equal(tool, path.join(configuredRoot, ".ttsc"));
    const expectedRecord = path.join(configuredRoot, ".ttsc", "records", createHash("sha256").update(path.resolve(linkedConfig)).digest("hex").slice(0, 32) + ".json");
    assert.equal(projectRecordFile(tool, linkedConfig), expectedRecord);
    const calls: [string, string][] = [];
    const context = { addWatchFile: function (this: unknown, file: string, watched: string): void {
      assert.equal(this, context);
      calls.push([file, watched]);
    } };
    const channel = createBuildWatchFile({ addWatchFile: () => assert.fail("Farm's module channel owns this record") },
      { framework: "farm", context } as unknown as Parameters<typeof createBuildWatchFile>[1], linkedFixture.file);
    const handoff = () => notifyWatchInputs({ project: {
      toolDirectory: tool, watching: false,
      register: (registration) => registerProjectRecord({ addWatchFile: channel.addWatchFile, registration }),
    } }, cached, linkedFixture.file, { consulted: [], filesystem: DEFAULT_FILESYSTEM_OPERATIONS, tsconfig: linkedConfig });
    handoff();
    assert.deepEqual(calls, [[linkedFixture.file, expectedRecord]]);
    const written = readProjectRecordFile(expectedRecord);
    assert.ok(written);
    assert.equal(written.tsconfig, linkedConfig);
    assert.ok(Object.prototype.hasOwnProperty.call(written.inputs, linkedConfig));
    assert.equal(path.relative(configuredRoot, expectedRecord).split(path.sep)[0], ".ttsc");
    assert.equal(fs.realpathSync.native(expectedRecord), path.join(physicalRoot, ".ttsc", "records", path.basename(expectedRecord)));
    const bytes = fs.readFileSync(expectedRecord);
    handoff();
    assert.deepEqual(calls, [[linkedFixture.file, expectedRecord], [linkedFixture.file, expectedRecord]]);
    assert.deepEqual(fs.readFileSync(expectedRecord), bytes);
  } finally {
    fs.rmSync(configuredRoot, { recursive: true, force: true });
    fs.rmSync(aliasParent, { recursive: true, force: true });
    linkedFixture.dispose();
  }
}
