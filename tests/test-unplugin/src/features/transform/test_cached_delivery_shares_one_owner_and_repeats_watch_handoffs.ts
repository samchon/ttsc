import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/filesystem/transformFilesystem";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";

/**
 * Verifies concurrent and repeated cached deliveries share one actual owner.
 *
 * The unresolved Promise is a supported cache input. Settling it supplies
 * literal consumer data, not a replacement compiler or a claimed native run.
 *
 * 1. Deliver six modules through one unresolved then retained owner.
 * 2. Contrast wrapper bypass, divergent text and identical cached output.
 * 3. Refuse candidate watch registration and deliver four modules through the
 *    actual coordinator's recorded-state fallback without candidate reads.
 * 4. Create a candidate and assert the actual action selector retires its owner;
 *    do not enter the subsequent native capture from this source unit.
 *
 * @evidence contracts/testing.md#behavioral-verification Six concurrent transformTtsc deliveries await the same current generation promise, return each literal output and retain that exact promise; repeated deliveries repeat the exact dependency and universal watch handoff without creating another owner. Four actual coordinator deliveries after candidate ENOSPC registration retain the ready owner while each makes native candidate probes and no candidate content reads; actual action selection on candidate appearance chooses capture and evicts the old owner.
 * @evidence contracts/testing.md#independent-expectations Six authored module names and PROBED output, the original promise identity and explicit types/package/plugin/config watch paths define every expected result. SHA-256 records actual host bytes only for fixture setup; no expected cache choice is computed by the production selector. Three literal candidate paths delimit independent filesystem counters; native creation distinguishes appearance from recorded absence, and capture is the independently expected choice when its negative predicate no longer holds.
 * @evidence contracts/testing.md#distinguishing-cases An unresolved common owner contrasts with fulfilled and repeated deliveries. Each module has its own callback ledger, so one delivery cannot stand in for the other five, and repeated handoff must neither disappear nor accumulate extra paths. A separate supported generation returns identical authored source, contrasting changed output with undefined first/repeated delivery while preserving owner and watch handoff. Failed candidate registration contrasts unchanged candidate replay with native appearance and owner eviction; native capture itself remains outside this unit.
 * @evidence contracts/testing.md#execution-ownership This named unit calls the actual delivery coordinator in process over native fixture files and an authored protocol result. It performs no compiler, Go peer, native watcher or external host execution; native capture invocation counts and plugin output production are not certified here. Actual wrapper queries bypass an unresolved resident owner; divergent delivered text contrasts with unchanged native bytes and retains literal cached output plus a single generation-owned warning registration. No stderr write receipt/count is inferred from that registration. A separate supported cache filesystem refuses candidate registration with ENOSPC; actual native snapshots/predicates feed the ready owner and transformTtsc automatically replays candidate proof. Native appearance is followed only through the owning selectCachedGenerationAction capture choice/eviction, since a full subsequent transformTtsc would start the real producer. Finally resets both owning caches and deletes the result filesystem registration.
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
  } finally {
    settle(observed);
    fixture.dispose();
  }
}
