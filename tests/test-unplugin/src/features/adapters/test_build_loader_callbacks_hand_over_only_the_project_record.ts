import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { unplugin } from "../../../../../packages/unplugin/src/core/unplugin";
import { sharedBuildTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/sharedBuildTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";

/**
 * Verifies build loader callbacks receive the project record alone.
 *
 * Actual raw adapter transform callbacks consume a literal already-observed
 * generation from the public shared cache. No producer, compiler or loader host
 * is substituted, and the expected output is authored consumer data.
 *
 * @evidence contracts/testing.md#behavioral-verification Real webpack/Rspack raw transform callbacks serve the exact cached output, retain its promise and hand one persisted project record to addDependency on first and repeated delivery; addMissingDependency/addContextDependency receive nothing. The record carries native config/declaration bytes, an absent candidate predicate, an empty listed directory predicate and project membership.
 * @evidence contracts/testing.md#independent-expectations One module-level record dependency rather than the individual source/config paths follows the build-host handoff contract. Exact literal output, promise identity, empty alternate channels and independently present native input keys distinguish wrong handoff or loss of caching. Node SHA-256 supplies the declaration hash; deliberately absent candidate and empty native directory fix their literal predicates. Record bytes stay identical across repeated handoff.
 * @evidence contracts/testing.md#distinguishing-cases Both raw compiler callback families use a nonwatching context with the same settled input; each is isolated by its native fixture/options key. Real watching streams, Farm wrapper roots and installed host cache invalidation remain external boundaries.
 * @evidence contracts/testing.md#execution-ownership This source unit calls unplugin.raw transform and shutdown callbacks in process over public consumer cache input. It restores cwd and resets both cache owners in finally; no Go peer, binary, build, watcher or native framework process is used.
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
}
