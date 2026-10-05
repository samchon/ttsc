import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import type { TtscWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";

/**
 * Verifies concurrent and repeated cached deliveries share one actual owner.
 *
 * The unresolved Promise is a supported cache input. Settling it supplies
 * literal consumer data, not a replacement compiler or a claimed native run.
 *
 * 1. Deliver six modules through one unresolved then retained owner.
 * 2. Contrast wrapper bypass, divergent text, identical cached output and
 *    out-of-walk output owners with present, omitted and missing source proofs.
 * 3. Refuse candidate watch registration and deliver four modules through the
 *    actual coordinator's recorded-state fallback without candidate reads.
 * 4. Create a candidate and assert the actual action selector retires its owner;
 *    do not enter the subsequent native capture from this source unit.
 * 5. Begin an explicit pass, change the descriptor after its first delivery,
 *    preserve later first deliveries, then require repeated-delivery capture.
 * 6. Write one generation below two host roots; contrast a blocked record
 *    with repeat delivery volatility and one actual process warning.
 *
 * @evidence contracts/testing.md#behavioral-verification Six concurrent transformTtsc deliveries await one current generation, return literal outputs and retain its Promise; repeats retain exact watch handoffs. Four coordinator deliveries after candidate ENOSPC registration retain the owner with probes and no candidate reads, then appearance selects capture/eviction. Six source and two out-of-walk outputs also share one Promise with an extra declaration output key excluded from project hashes. Actual captureExternalInputSnapshot accepts each external source's own proof despite omitted graph nodes, rejects missing proof and changed recorded content; a fresh consumer checkpoint serves the changed external output with its sibling.
 *   A separate actual coordinator pair opens successive passes around a new empty admitted directory, retains the same Promise and membership digest, registers its added directory and omits membership when not requested.
 * @evidence contracts/testing.md#independent-expectations Six authored module names and PROBED output, the original promise identity and explicit types/package/plugin/config watch paths define every expected result. SHA-256 records actual host bytes only for fixture setup; no expected cache choice is computed by the production selector. Three literal candidate paths delimit independent filesystem counters; native creation distinguishes appearance from recorded absence, and capture is the independently expected choice when its negative predicate no longer holds.
 *   Literal one-carrier counts, unchanged digest, original src directory, new later-reproved directory and an empty opt-out list distinguish directory population from root-file membership; the previous carrier stays unchanged.
 * @evidence contracts/testing.md#distinguishing-cases Unresolved versus fulfilled/repeated owners and separate module ledgers distinguish delivery and handoff. Identical output remains undefined without losing ownership. Candidate ENOSPC contrasts unchanged replay with deleting/recreating the same candidate parent and admitting its new source child, then appearance/eviction. Equal native bytes across two external graph targets contrast with a retargeted directory link: actual recorded graph proof must reject changed realpath alone. A shared native corpus contrasts ordinary source outputs, two out-of-walk transform outputs and one declaration-only output key; the project snapshot never adopts node_modules keys. Both listed and omitted external graph nodes reuse proven output, while missing own proof and later changed bytes fail with exact external failure kinds. An explicit build pass contrasts established first-delivery proof shared by five new siblings with descriptor revalidation for a repeated identity. Fresh supplied consumer facts and different literal output recover one shared owner; retry budget is separately owned by test_transform_attempt_disposition_preserves_retry_and_terminal_policy, not inferred from this corpus.
 *   Same generation across a reproof boundary contrasts with original versus refreshed directory populations and requested versus absent membership handoff.
 * @evidence contracts/testing.md#execution-ownership This named unit calls the actual delivery coordinator in process over native fixture files and an authored protocol result. It performs no compiler, Go peer, native watcher or external host execution; native capture invocation counts and plugin output production are not certified here. Actual wrapper queries bypass an unresolved resident owner; divergent delivered text contrasts with unchanged native bytes and retains literal cached output plus a single generation-owned warning registration. No stderr write receipt/count is inferred from that registration. A separate supported cache filesystem refuses candidate registration with ENOSPC; actual native snapshots/predicates feed the ready owner and transformTtsc automatically replays candidate proof. Native appearance is followed only through the owning selectCachedGenerationAction capture choice/eviction, since a full subsequent transformTtsc would start the real producer. Two real host tool roots receive distinct readable records with one basename and the same generation Promise; a regular-file records blocker yields no registration, two volatility callbacks and one actual process warning. The warning listener is removed and owned record storage is deleted in finally. These are delivery/record facts, not installed host cache or native capture certification. Finally resets both owning caches and deletes the result filesystem registration.
 *   The directory row owns actual ready-owner coordinator reproof and callback publication. It does not acquire a native generation or register an OS watcher for the new directory.
 */
export async function test_cached_delivery_shares_one_owner_and_repeats_watch_handoffs(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const modules = Array.from({ length: 6 }, (_, index) => path.join(root, "src", "mod" + index + ".ts"));
  const code = 'export const value = "PROBED";\n';
  const dependency = path.join(root, "src", "types.d.ts");
  fs.writeFileSync(dependency, "export declare const typed: number;\n");
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}');
  fs.writeFileSync(path.join(root, "plugin.cjs"), "module.exports = () => {};\n");
  for (const file of modules) fs.writeFileSync(file, fixture.source);
  const hostInputs = ["package.json", "plugin.cjs", "tsconfig.json"].map((file) => path.join(root, file));
  const result = {
    type: "success" as const,
    typescript: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), code])),
    dependencies: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), ["src/types.d.ts"]])),
    hostInputs,
    hostInputHashes: Object.fromEntries(hostInputs.map((file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])),
    hostInputRealpaths: Object.fromEntries(hostInputs.map((file) => [file, fs.realpathSync.native(file)])),
  };
  const observed = observeValidationUnitGeneration(root, result);
  let settle!: (value: TtscCachedProjectTransform) => void;
  const owner = new Promise<TtscCachedProjectTransform>((resolve) => { settle = resolve; });
  fixture.cache.set(fixture.key, owner);
  const ledgers = modules.map(() => [] as string[]);
  const expected = [dependency, ...hostInputs].sort();
  const deliver = (file: string, index: number) => fixture.api.transformTtsc(
    file, fixture.source, fixture.options, undefined, fixture.cache,
    { addWatchFile: (input) => ledgers[index]!.push(input) },
  );
  try {
    const wrapperWatches: string[] = [];
    for (const query of ["?raw", "?worker"]) {
      const wrapper = "export default \"HOST-WRAPPER\";\n";
      assert.equal(await fixture.api.transformTtsc(modules[0]! + query,
        wrapper, fixture.options, undefined, fixture.cache,
        { addWatchFile: (input) => wrapperWatches.push(input) }), undefined,
        "host wrappers bypass even an unresolved resident generation");
      assert.equal(fixture.cache.get(fixture.key), owner);
    }
    assert.deepEqual(wrapperWatches, [], "wrapper bypass registers no program watch inputs");
    const deliveries = modules.map(deliver);
    assert.equal(fixture.cache.size, 1);
    assert.equal(fixture.cache.get(fixture.key), owner);
    settle(observed);
    const outputs = await Promise.all(deliveries);
    assert.deepEqual(outputs.map((output) => output?.code), [code, code, code, code, code, code]);
    assert.equal(fixture.cache.get(fixture.key), owner);
    for (const ledger of ledgers) assert.deepEqual(ledger.sort(), expected);
    for (const ledger of ledgers) ledger.length = 0;
    const repeats = await Promise.all(modules.map(deliver));
    assert.deepEqual(repeats.map((output) => output?.code), [code, code, code, code, code, code]);
    assert.equal(fixture.cache.get(fixture.key), owner);
    for (const ledger of ledgers) assert.deepEqual(ledger.sort(), expected);
    assert.equal(observed.divergentDeliveryReported, undefined);
    const divergent = fixture.source + "// earlier host plugin rewrote this delivery\n";
    for (let repetition = 0; repetition < 2; repetition++) {
      const output = await fixture.api.transformTtsc(modules[1]!, divergent,
        fixture.options, undefined, fixture.cache);
      assert.equal(output?.code, code,
        "unchanged disk evidence retains the compiler-owned output for divergent delivered text");
      assert.equal(fixture.cache.get(fixture.key), owner);
      assert.equal(fs.readFileSync(modules[1]!, "utf8"), fixture.source);
      assert.deepEqual([...observed.divergentDeliveryReported!], [modules[1]!],
        "one source spelling registers one warning attempt for this generation");
    }
    // Warning registration is observed through actual generation state; this
    // row does not intercept stderr or certify its write receipt/count.
    assert.equal((await deliver(modules[2]!, 2))?.code, code);
    assert.equal((await deliver(modules[1]!, 1))?.code, code);
    assert.equal((await fixture.api.transformTtsc(modules[0]! + "?t=1",
      fixture.source, fixture.options, undefined, fixture.cache))?.code, code,
      "ordinary timestamp queries still deliver the program");
    assert.equal(fixture.cache.get(fixture.key), owner);
    assert.deepEqual([...observed.divergentDeliveryReported!], [modules[1]!]);
    const unchanged = observeValidationUnitGeneration(root, {
      ...result,
      typescript: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), fixture.source])),
    });
    const unchangedOwner = Promise.resolve(unchanged);
    fixture.cache.set(fixture.key, unchangedOwner);
    ledgers[0]!.length = 0;
    assert.equal(await deliver(modules[0]!, 0), undefined, "identical cached output leaves the host's source ownership intact");
    assert.equal(fixture.cache.get(fixture.key), unchangedOwner);
    assert.deepEqual(ledgers[0]!.sort(), expected);

    const candidates = [0, 1, 2].map((index) => path.join(root, "node_modules", "candidate-" + index, "index.ts"));
    for (const candidate of candidates) fs.mkdirSync(path.dirname(candidate), { recursive: true });
    assert.equal(fs.existsSync(candidates[0]!), false);
    const candidateNames = candidates.map((file) => path.relative(root, file).split(path.sep).join("/"));
    let probes = 0;
    let reads = 0;
    let registrationAttempts = 0;
    const unavailableCache = createTtscTransformCache({
      stat: (file) => {
        if (candidates.includes(file)) probes++;
        return fs.statSync(file);
      },
      readFile: (file) => {
        if (candidates.includes(file)) reads++;
        return fs.readFileSync(file);
      },
      watch: () => {
        registrationAttempts++;
        throw Object.assign(new Error("authored candidate registration unavailable"), { code: "ENOSPC" });
      },
    });
    const filesystem = transformFilesystem(unavailableCache);
    const candidateResult = {
      ...result,
      graph: {
        edges: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), [] as string[]])),
        globals: [], configs: [],
        candidates: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), candidateNames])),
        inputObservations: Object.fromEntries(candidateNames.map((file) => [file, { fileExists: false }])),
      },
    };
    TRANSFORM_RESULT_FILESYSTEM.set(candidateResult, filesystem);
    const candidateOwner: TtscCachedProjectTransform = {
      result: candidateResult, projectRoot: root, tsconfig: observed.tsconfig,
      membershipPolicy: observed.membershipPolicy, inputHashes: {},
    };
    try {
      const state = envelopeDerivation(candidateOwner);
      const project = collectProjectInputSnapshot(root, state.identityContext, filesystem, undefined, { policy: candidateOwner.membershipPolicy });
      assert.equal(project.complete, true);
      candidateOwner.inputHashes = project.hashes;
      candidateOwner.projectDirectories = project.projectDirectories;
      candidateOwner.projectSnapshotComplete = true;
      const selected = selectExternalInputPaths({ filesystem, membershipPolicy: candidateOwner.membershipPolicy, projectRoot: root, result: candidateResult });
      const external = captureExternalInputSnapshot(candidateOwner, selected, undefined);
      assert.equal(external.complete, true);
      assert.deepEqual(candidates.filter((file) => !selected.includes(file)), []);
      candidateOwner.externalInputPaths = selected;
      candidateOwner.externalInputHashes = external.hashes;
      candidateOwner.externalInputObservations = external.observations;
      candidateOwner.externalInputRealpaths = external.realpaths;
      const universal = captureUniversalHostInputValidation(candidateOwner, modules[0]!);
      assert.ok(universal.validation);
      candidateOwner.hostInputValidation = universal.validation;
      const failed = await createHostInputMutationTracker(candidates, filesystem, new Set(candidates), "rename", root);
      candidateOwner.candidateMutationTracker = failed;
      assert.equal(failed.failed, true);
      assert.ok(registrationAttempts > 0, "the supplied backend refused actual registration");
      const ready = Promise.resolve(candidateOwner);
      unavailableCache.set(fixture.key, ready);
      for (const file of modules.slice(0, 4)) {
        probes = 0;
        reads = 0;
        const output = await fixture.api.transformTtsc(file, fixture.source, fixture.options, undefined, unavailableCache);
        assert.equal(output?.code, code);
        assert.equal(unavailableCache.get(fixture.key), ready);
        assert.ok(probes > 0, "actual coordinator fallback replays absent candidates");
        assert.equal(reads, 0, "existence-only candidate proof reads no candidate content");
      }
      fs.rmSync(path.dirname(candidates[0]!), { recursive: true, force: true });
      fs.mkdirSync(path.dirname(candidates[0]!), { recursive: true });
      fs.writeFileSync(candidates[0]!, "export {};\n");
      assert.equal(selectCachedGenerationAction({ cache: unavailableCache, cached: candidateOwner,
        epoch: undefined, file: modules[0]!, generation: ready, key: fixture.key, source: fixture.source }), "capture");
      assert.equal(unavailableCache.has(fixture.key), false, "candidate appearance retires the old owner");
      // Calling transformTtsc after this eviction would start the real native
      // producer. This source unit owns the actual capture choice, not capture.
    } finally {
      resetTtscTransformCache(unavailableCache);
      TRANSFORM_RESULT_FILESYSTEM.delete(candidateResult);
    }
    ledgers[0]!.length = 0;
    assert.equal(await deliver(modules[0]!, 0), undefined, "a repeated unchanged delivery stays a no-op");
    assert.equal(fixture.cache.get(fixture.key), unchangedOwner);
    assert.deepEqual(ledgers[0]!.sort(), expected);

    const externalSources = [0, 1].map((index) => path.join(root, "node_modules", "external-" + index, "index.ts"));
    for (const file of externalSources) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, fixture.source);
    }
    const outputOnly = path.join(root, "node_modules", "emitted.d.ts");
    fs.writeFileSync(outputOnly, "export declare const emitted: number;\n");
    const externalNames = externalSources.map((file) => path.relative(root, file).split(path.sep).join("/"));
    const externalCodes = ['export const external0 = "PROBED";\n', 'export const external1 = "PROBED";\n'];
    for (const omitExternalNodes of [false, true]) {
      const graphFiles = [...modules, ...externalSources];
      const sourceProofs = Object.fromEntries(graphFiles.map((file) => [path.relative(root, file).split(path.sep).join("/"), createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
      const outResult = {
        ...result,
        dependencies: undefined,
        typescript: {
          ...result.typescript,
          [externalNames[0]!]: externalCodes[0]!,
          [externalNames[1]!]: externalCodes[1]!,
          "node_modules/emitted.d.ts": "export declare const emitted: string;\n",
        },
        graph: {
          edges: Object.fromEntries((omitExternalNodes ? modules : graphFiles).map((file) => [path.relative(root, file).split(path.sep).join("/"), [] as string[]])),
          globals: [], configs: [],
          inputHashes: sourceProofs,
          inputRealpaths: Object.fromEntries(graphFiles.map((file) => [path.relative(root, file).split(path.sep).join("/"), fs.realpathSync.native(file)])),
        },
      };
      const outObserved = observeValidationUnitGeneration(root, outResult);
      assert.equal(Object.keys(outObserved.inputHashes).some((key) => key.startsWith("node_modules/")), false,
        "output keys cannot expand the actual project walk snapshot");
      const captured = captureExternalInputSnapshot(outObserved, externalSources, undefined);
      assert.equal(captured.complete, true, "own source proofs survive absent graph nodes");
      assert.deepEqual(captured.failures.entries, []);
      const outOwner = Promise.resolve(outObserved);
      fixture.cache.set(fixture.key, outOwner);
      for (let repetition = 0; repetition < 2; repetition++) {
        const delivered = [];
        for (const file of graphFiles) delivered.push(await fixture.api.transformTtsc(file,
          fs.readFileSync(file, "utf8"), fixture.options, undefined, fixture.cache));
        assert.deepEqual(delivered.map((output) => output?.code), [code, code, code, code, code, code, ...externalCodes]);
        assert.equal(fixture.cache.get(fixture.key), outOwner);
      }
      if (omitExternalNodes) {
        const unprovenResult = {
          ...outResult,
          graph: { ...outResult.graph,
            inputHashes: Object.fromEntries(Object.entries(sourceProofs).filter(([name]) => name !== externalNames[0])),
          },
        };
        const unproven = observeValidationUnitGeneration(root, unprovenResult);
        const refused = captureExternalInputSnapshot(unproven, [externalSources[0]!], undefined);
        assert.equal(refused.complete, false, "a later host read cannot manufacture the missing source proof");
        assert.deepEqual(refused.failures.entries.map(({ domain, kind, path: file }) => ({ domain, kind, path: file })),
          [{ domain: "external", kind: "graph-proof-missing", path: externalSources[0]! }]);
        fs.appendFileSync(externalSources[0]!, "// source changed after recorded proof\n");
        const raced = captureExternalInputSnapshot(outObserved, [externalSources[0]!], undefined);
        assert.equal(raced.complete, false);
        assert.deepEqual(raced.failures.entries.map(({ domain, kind, path: file }) => ({ domain, kind, path: file })),
          [{ domain: "external", kind: "graph-content-changed", path: externalSources[0]! }]);
        assert.equal(selectCachedGenerationAction({ cache: fixture.cache, cached: outObserved,
          epoch: undefined, file: modules[0]!, generation: outOwner, key: fixture.key, source: fixture.source }), "capture");
        assert.equal(fixture.cache.has(fixture.key), false);
        const fresh = observeValidationUnitGeneration(root, {
          ...outResult,
          typescript: { ...outResult.typescript, [externalNames[0]!]: 'export const external0 = "PROBED-AFTER";\n' },
          graph: { ...outResult.graph,
            inputHashes: { ...sourceProofs, [externalNames[0]!]: createHash("sha256").update(fs.readFileSync(externalSources[0]!)).digest("hex") },
          },
        });
        const freshOwner = Promise.resolve(fresh);
        fixture.cache.set(fixture.key, freshOwner);
        assert.equal((await fixture.api.transformTtsc(externalSources[0]!, fs.readFileSync(externalSources[0]!, "utf8"),
          fixture.options, undefined, fixture.cache))?.code, 'export const external0 = "PROBED-AFTER";\n');
        assert.equal((await deliver(modules[0]!, 0))?.code, code);
        assert.equal(fixture.cache.get(fixture.key), freshOwner);
      }
    }
    const edgeDirectories = ["edge-first", "edge-second"].map((name) => path.join(root, "node_modules", name));
    const edgeBytes = "export declare const linked: number;\n";
    for (const directory of edgeDirectories) {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "index.d.ts"), edgeBytes);
    }
    const edgeLink = path.join(root, "node_modules", "edge-link");
    const edgeFile = path.join(edgeLink, "index.d.ts");
    const linkKind = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(edgeDirectories[0]!, edgeLink, linkKind);
    const edgeHash = createHash("sha256").update(edgeBytes).digest("hex");
    const originalTarget = fs.realpathSync.native(edgeFile);
    const edgeResult = {
      ...result,
      graph: {
        edges: Object.fromEntries(modules.map((file) => ["src/" + path.basename(file), ["node_modules/edge-link/index.d.ts"]])),
        globals: [], configs: [],
        inputHashes: { "node_modules/edge-link/index.d.ts": edgeHash },
        inputRealpaths: { "node_modules/edge-link/index.d.ts": originalTarget },
      },
    };
    try {
      const linked = observeValidationUnitGeneration(root, edgeResult);
      assert.equal(captureExternalInputSnapshot(linked, [edgeFile], undefined).complete, true);
      fs.rmSync(edgeLink, { recursive: true, force: true });
      fs.symlinkSync(edgeDirectories[1]!, edgeLink, linkKind);
      assert.notEqual(fs.realpathSync.native(edgeFile), originalTarget);
      assert.equal(createHash("sha256").update(fs.readFileSync(edgeFile)).digest("hex"), edgeHash);
      const retargeted = captureExternalInputSnapshot(linked, [edgeFile], undefined);
      assert.equal(retargeted.complete, false, "same content cannot replace the recorded physical graph target");
      assert.deepEqual(retargeted.failures.entries.map(({ domain, kind, path: file }) => ({ domain, kind, path: file })),
        [{ domain: "external", kind: "graph-realpath-changed", path: edgeFile }]);
    } finally {
      fs.rmSync(edgeLink, { recursive: true, force: true });
      for (const directory of edgeDirectories) fs.rmSync(directory, { recursive: true, force: true });
    }

    const recordObserved = observeValidationUnitGeneration(root, result);
    const recordOwner = Promise.resolve(recordObserved);
    fixture.cache.set(fixture.key, recordOwner);
    const recordHosts = path.join(root, "node_modules", "record-hosts");
    const tools = ["a", "b"].map((name) => path.join(recordHosts, name, ".ttsc"));
    const records: string[] = [];
    try {
      for (const toolDirectory of tools) {
        const registrations: string[] = [];
        assert.equal((await fixture.api.transformTtsc(modules[0]!, fixture.source,
          fixture.options, undefined, fixture.cache, {
            project: { toolDirectory, register: ({ record }) => { registrations.push(record); } },
          }))?.code, code);
        assert.equal(fixture.cache.get(fixture.key), recordOwner);
        assert.equal(registrations.length, 1);
        const record = registrations[0]!;
        assert.equal(path.dirname(record), path.join(toolDirectory, "records"));
        const stored = readProjectRecordFile(record);
        assert.ok(stored);
        assert.equal(stored.root, root);
        assert.equal(stored.tsconfig, recordObserved.tsconfig);
        records.push(record);
      }
      assert.notEqual(records[0], records[1]);
      assert.equal(path.basename(records[0]!), path.basename(records[1]!));
      const blockedTool = path.join(recordHosts, "blocked", ".ttsc");
      fs.mkdirSync(blockedTool, { recursive: true });
      fs.writeFileSync(path.join(blockedTool, "records"), "ordinary file blocks record storage\n");
      const blockedRecord = path.join(blockedTool, "records", path.basename(records[0]!));
      const registered: string[] = [];
      const warnings: (Error & { code?: string })[] = [];
      const onWarning = (warning: Error & { code?: string }): void => {
        if (warning.code === "TTSC_PROJECT_RECORD_UNWRITABLE" && warning.message.includes(blockedRecord)) {
          warnings.push(warning);
        }
      };
      let volatileCalls = 0;
      process.on("warning", onWarning);
      try {
        for (let delivery = 0; delivery < 2; delivery++) {
          assert.equal((await fixture.api.transformTtsc(modules[0]!, fixture.source,
            fixture.options, undefined, fixture.cache, {
              project: { toolDirectory: blockedTool, register: ({ record }) => { registered.push(record); } },
              markVolatile: () => { ++volatileCalls; },
            }))?.code, code);
          assert.equal(fixture.cache.get(fixture.key), recordOwner);
        }
        await new Promise<void>((resolve) => { setImmediate(resolve); });
        assert.deepEqual(registered, []);
        assert.equal(volatileCalls, 2, "each delivery without its record withdraws host caching");
        assert.equal(warnings.length, 1, "the same unwritable record path reports one warning");
        assert.equal(fs.existsSync(blockedRecord), false);
      } finally {
        process.off("warning", onWarning);
      }
    } finally {
      fs.rmSync(recordHosts, { recursive: true, force: true });
    }

    const membershipObserved = observeValidationUnitGeneration(root, result);
    const membershipOwner = Promise.resolve(membershipObserved);
    fixture.cache.set(fixture.key, membershipOwner);
    const membershipBatches: TtscWatchInput[][] = [];
    const deliverMembership = async (membership: boolean): Promise<TtscWatchInput[]> => {
      let registered: readonly TtscWatchInput[] = [];
      assert.equal((await fixture.api.transformTtsc(modules[0]!, fixture.source,
        fixture.options, undefined, fixture.cache, {
          addWatchFiles: (inputs) => { registered = inputs; }, membership,
        }))?.code, code);
      assert.equal(fixture.cache.get(fixture.key), membershipOwner);
      const inputs = registered.filter((input) => input.evidence?.state?.codec === "membership");
      membershipBatches.push(inputs);
      return inputs;
    };
    beginTtscTransformBuild(fixture.cache);
    const firstMembership = await deliverMembership(true);
    assert.equal(firstMembership.length, 1);
    assert.equal(firstMembership[0]!.file, root);
    const firstMembershipState = firstMembership[0]!.evidence!.state;
    assert.ok(firstMembershipState);
    assert.equal(firstMembershipState.codec, "membership");
    if (firstMembershipState.codec !== "membership") throw new Error("Expected membership evidence");
    assert.ok(firstMembershipState.directories.includes(path.join(root, "src")));
    const laterDirectory = path.join(root, "src", "later-reproved");
    fs.mkdirSync(laterDirectory);
    try {
      beginTtscTransformBuild(fixture.cache);
      const nextMembership = await deliverMembership(true);
      assert.equal(nextMembership.length, 1);
      const nextMembershipState = nextMembership[0]!.evidence!.state;
      assert.ok(nextMembershipState);
      assert.equal(nextMembershipState.codec, "membership");
      if (nextMembershipState.codec !== "membership") throw new Error("Expected membership evidence");
      assert.equal(nextMembershipState.digest, firstMembershipState.digest,
        "an empty admitted directory changes no root-file membership");
      assert.ok(nextMembershipState.directories.includes(laterDirectory),
        "coordinator reproof hands off the newly visited directory");
      assert.equal(firstMembershipState.directories.includes(laterDirectory), false,
        "the previous delivered carrier keeps its original directory population");
      assert.deepEqual(await deliverMembership(false), []);
      assert.equal(membershipBatches.length, 3);
    } finally {
      fs.rmdirSync(laterDirectory);
    }

    const passObserved = observeValidationUnitGeneration(root, result);
    const passOwner = Promise.resolve(passObserved);
    fixture.cache.set(fixture.key, passOwner);
    beginTtscTransformBuild(fixture.cache);
    assert.equal((await deliver(modules[0]!, 0))?.code, code);
    assert.equal(typeof passObserved.deliveryEpoch, "number");
    assert.equal(fixture.cache.get(fixture.key), passOwner);
    fs.appendFileSync(path.join(root, "plugin.cjs"), "// changed after the first pass delivery\n");
    for (const file of modules.slice(1)) {
      assert.equal((await fixture.api.transformTtsc(file, fixture.source,
        fixture.options, undefined, fixture.cache))?.code, code);
      assert.equal(fixture.cache.get(fixture.key), passOwner,
        "later first deliveries share the pass's established proof");
    }
    assert.equal(selectCachedGenerationAction({ cache: fixture.cache, cached: passObserved,
      epoch: passObserved.deliveryEpoch, file: modules[0]!, generation: passOwner,
      key: fixture.key, source: fixture.source }), "capture",
      "a repeated delivery revalidates the descriptor rather than sharing first-delivery proof");
    assert.equal(fixture.cache.has(fixture.key), false);
    // The next coordinator delivery would acquire a producer. This row ends
    // at the actual mismatch action and does not certify capture or read counts.
  } finally {
    settle(observed);
    fixture.dispose();
  }
}
