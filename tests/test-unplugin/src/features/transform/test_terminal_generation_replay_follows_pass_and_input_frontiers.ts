import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { retainPassVerdict } from "../../../../../packages/unplugin/src/core/transform/cache/retainPassVerdict";
import { replaysTerminalGeneration } from "../../../../../packages/unplugin/src/core/transform/cache/replaysTerminalGeneration";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { TtscUnstableGenerationError } from "../../../../../packages/unplugin/src/core/transform/errors/TtscUnstableGenerationError";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { projectWalkFailureFingerprint } from "../../../../../packages/unplugin/src/core/transform/generation/projectWalkFailureFingerprint";
import { walkSnapshotComplete } from "../../../../../packages/unplugin/src/core/transform/validation/walkSnapshotComplete";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import type { ITtscCompilerTransformation } from "ttsc";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { compilerGraphInputProofFailures } from "../../../../../packages/unplugin/src/core/transform/validation/compilerGraphInputProofFailures";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { captureFailedGenerationInputStates } from "../../../../../packages/unplugin/src/core/transform/generation/captureFailedGenerationInputStates";
import { createUnstableGenerationError } from "../../../../../packages/unplugin/src/core/transform/generation/createUnstableGenerationError";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";

/**
 * Verifies retained failures respect their pass and observed input frontier.
 *
 * Failed envelopes and unstable errors are supported consumer inputs, not
 * synthetic compiler attempts. Actual capture retry counts remain E2E.
 * An unreadable null graph baseline also feeds a ready owner: four actual
 * deliveries keep that owner without earning a content reuse signature.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual retainPassVerdict and replaysTerminalGeneration retain one current failed promise, reject successful/no-pass/replaced retention, replay only its epoch, and share one stable environment confirmation across forty deliveries before observing an actual next-turn edit. Actual graph proof and external capture validators classify missing content authority and producer candidate failure; actual error rendering preserves two supplied attempt records, eight retained witnesses and omission. Four coordinator callers and a later wave receive that same terminal error from its retained promise. EACCES graph reads match recorded null without gaining a signature, while recorded SHA remains a content contradiction; restored distinct bytes produce exact graph/content-changed and shared terminal replay without changing native content metadata.
 * @evidence contracts/testing.md#independent-expectations Literal true/false replay results, exact retained error identity and equal read counts after the first confirmation express ownership and turn sharing. Actual source bytes change independently; the real walk supplies comparison inputs rather than the expected verdict. Twelve authored missing-proof paths fix eight printable witnesses and four omitted occurrences; graph-free output paths and the candidate's explicit producer reason fix exact native-relative diagnostic lines. Node SHA records actual source bytes, not a generated output oracle. Null has no readable content to replace with a signature; distinct literal readable bytes must disagree with null or the independently hashed original bytes even while native content metadata is fixed.
 * @evidence contracts/testing.md#distinguishing-cases Same pass versus new/undefined pass, failure versus successful missing output, current versus replaced promise, stable versus changed environment and fresh observed recovery are contrasted without inventing a compiler result from the validator. Native graph files with EACCES supplied reads contrast null and independent original SHA; both keep absent signatures, restored alternate read bytes disagree with either unchanged producer baseline, and repeated callers retain the identical error and Promise.
 * @evidence contracts/testing.md#execution-ownership This named unit calls source functions in process over a native temporary corpus and authored protocol data. setImmediate separates actual comparison turns; no compiler, synthetic Go peer, product host or native notification is run. Cache owners are reset in finally. Missing-proof inputs are validator consumer data, not native producer receipts. EACCES and alternate bytes belong to the supported cache read capability, not a reproduced native permission failure. The formatter is given two actual validator results, not a claim that capture executed twice. A rejected promise is supported cache input; awaitOrEvict and transformTtsc own terminal retention/replay without private table writes. Changed environment is checked only through replay selection, never through a subsequent coordinator call that would start a compiler. Initial acquisition, rejected-attempt union/cleanup ordering, native IPC and per-attempt clock registration are outside this unit.
 */
export async function test_terminal_generation_replay_follows_pass_and_input_frontiers(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  let reads = 0;
  const cache = createTtscTransformCache({ readFile: (file) => {
    reads += 1;
    return fs.readFileSync(file);
  } });
  const filesystem = transformFilesystem(cache);
  const root = path.dirname(path.dirname(fixture.file));
  try {
    const promise = Promise.resolve(fixture.good);
    cache.set("failure", promise);
    const failed = { type: "failure" as const, typescript: {}, diagnostics: [] };
    const original = new Error("literal compiler failure");
    const verdict = retainPassVerdict(cache, "failure", promise, 1, failed, original);
    assert.ok(verdict);
    assert.equal(verdict.message, "literal compiler failure");
    assert.equal(retainPassVerdict(cache, "failure", promise, 1, failed, new Error("later")), verdict);
    assert.equal(retainPassVerdict(cache, "failure", promise, undefined, failed, original), undefined);
    assert.equal(retainPassVerdict(cache, "failure", promise, 1, fixture.good.result, original), undefined);
    cache.set("failure", Promise.resolve({ ...fixture.good }));
    assert.equal(retainPassVerdict(cache, "failure", promise, 1, failed, original), undefined);
    const props = { currentFile: fixture.file, currentSource: fixture.source, filesystem };
    assert.equal(replaysTerminalGeneration(verdict, 1, props), true);
    assert.equal(replaysTerminalGeneration(verdict, 2, props), false);
    assert.equal(replaysTerminalGeneration(verdict, undefined, props), false);

    const observe = () => {
      TRANSFORM_RESULT_FILESYSTEM.set(fixture.good.result, filesystem);
      const cached = observeValidationUnitGeneration(root, fixture.good.result);
      cached.deliveryEpoch = 1;
      const identities = envelopeDerivation(cached).identityContext;
      const snapshot = collectProjectInputSnapshot(root, identities, filesystem, undefined, { policy: cached.membershipPolicy });
      cached.projectDirectories = snapshot.projectDirectories;
      return new TtscUnstableGenerationError("literal unstable observation", {
        cached,
        declaredInputs: undefined,
        inputStates: new Map(),
        projectInputHashes: snapshot.hashes,
        projectWalkComplete: walkSnapshotComplete(snapshot, undefined),
        projectWalkFailures: projectWalkFailureFingerprint(snapshot, undefined, root, identities),
      });
    };
    const unstable = observe();
    assert.equal(replaysTerminalGeneration(unstable, 2, props), false, "a new pass grants a fresh attempt");
    assert.equal(replaysTerminalGeneration(unstable, 1, props), true);
    const firstReads = reads;
    for (let delivery = 0; delivery < 40; delivery += 1)
      assert.equal(replaysTerminalGeneration(unstable, 1, props), true);
    assert.equal(reads, firstReads, "one stable environment confirmation serves the current turn");
    await new Promise<void>((resolve) => setImmediate(resolve));
    fs.appendFileSync(fixture.file, "// changed actual input\n");
    assert.equal(replaysTerminalGeneration(unstable, undefined, {
      ...props, currentSource: fs.readFileSync(fixture.file, "utf8"),
    }), false);
    const recovered = observe();
    assert.equal(replaysTerminalGeneration(recovered, 1, {
      ...props, currentSource: fs.readFileSync(fixture.file, "utf8"),
    }), true);

    const moduleFiles = [fixture.file, ...[1, 2, 3].map((index) => path.join(root, "src", "mod" + index + ".ts"))];
    for (const file of moduleFiles.slice(1)) fs.writeFileSync(file, "export const sibling = 1;\n");
    const dependencies = Array.from({ length: 12 }, (_, index) => path.join(root, "node_modules", "dep" + index, "index.d.ts"));
    for (const file of dependencies) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "export interface Input { value: number }\n");
    }
    const externalFiles = [0, 1].map((index) => path.join(root, "node_modules", "external-source", "mod" + index + ".ts"));
    fs.mkdirSync(path.dirname(externalFiles[0]!), { recursive: true });
    for (const file of externalFiles) fs.writeFileSync(file, "export const external = 1;\n");
    const candidate = path.join(root, "node_modules", "candidate", "index.ts");
    fs.mkdirSync(path.dirname(candidate), { recursive: true });
    assert.equal(fs.existsSync(candidate), false);
    const relative = (file: string) => path.relative(root, file).split(path.sep).join("/");
    const moduleNames = moduleFiles.map(relative);
    const dependencyNames = dependencies.map(relative);
    const sha = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    // A readable metadata stamp cannot replace a missing content comparison.
    const unreadable = dependencies[0]!;
    const nativeBytes = fs.readFileSync(unreadable);
    const contentMetadata = () => {
      const stat = fs.statSync(unreadable, { bigint: true });
      return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.birthtimeNs];
    };
    const nativeMetadata = contentMetadata();
    const suppliedBytes = Buffer.from("export interface Input { value: string }\n");
    assert.notDeepEqual(suppliedBytes, nativeBytes);
    for (const recordedHash of [null, sha(unreadable)]) {
      let denied = true;
      const deniedCache = createTtscTransformCache({
        readFile: (input) => {
          if (path.resolve(input) === unreadable) {
            if (denied) {
              const error = new Error("authored unreadable graph input") as NodeJS.ErrnoException;
              error.code = "EACCES";
              throw error;
            }
            return suppliedBytes;
          }
          return fs.readFileSync(input);
        },
      });
      const view = transformFilesystem(deniedCache);
      const cachedCode = "export const cachedGraphDelivery = true;\n";
      const result: ITtscCompilerTransformation.ISuccess = {
        type: "success",
        typescript: Object.fromEntries(moduleFiles.map((input) => [relative(input), cachedCode])),
        graph: {
          edges: Object.fromEntries(moduleNames.map((name) => [name, [relative(unreadable)]])),
          globals: [], configs: [],
          inputHashes: { ...Object.fromEntries(moduleFiles.map((input) => [relative(input), sha(input)])),
            [relative(unreadable)]: recordedHash },
          inputRealpaths: { ...Object.fromEntries(moduleFiles.map((input) => [relative(input), fs.realpathSync.native(input)])),
            [relative(unreadable)]: fs.realpathSync.native(unreadable) },
        },
      };
      const cached: TtscCachedProjectTransform = {
        result, projectRoot: root, tsconfig: path.join(root, "tsconfig.json"),
        membershipPolicy: fixture.good.membershipPolicy, inputHashes: {},
      };
      TRANSFORM_RESULT_FILESYSTEM.set(result, view);
      try {
        const identities = envelopeDerivation(cached).identityContext;
        const snapshot = collectProjectInputSnapshot(root, identities, view, undefined, { policy: cached.membershipPolicy });
        assert.equal(snapshot.complete, true);
        cached.inputHashes = snapshot.hashes;
        cached.projectDirectories = snapshot.projectDirectories;
        cached.projectSnapshotComplete = true;
        cached.externalInputPaths = [unreadable];
        const contentChanged = [{ domain: "graph", kind: "content-changed", path: unreadable }];
        const initial = compilerGraphInputProofFailures(cached);
        assert.deepEqual(initial.entries, recordedHash === null ? [] : contentChanged);
        const observed = captureExternalInputSnapshot(cached, [unreadable], undefined);
        assert.equal(observed.complete, recordedHash === null);
        assert.equal(Object.hasOwn(observed.signatures, unreadable), false,
          "no unreadable content receives metadata reuse authority");
        if (recordedHash === null) {
          cached.externalInputHashes = observed.hashes;
          cached.externalInputRealpaths = observed.realpaths;
          cached.externalInputObservations = observed.observations;
          const universal = captureUniversalHostInputValidation(cached, moduleFiles[0]!);
          assert.ok(universal.validation);
          cached.hostInputValidation = universal.validation;
          const ready = Promise.resolve(cached);
          deniedCache.set(fixture.key, ready);
          for (const input of moduleFiles) {
            const source = fs.readFileSync(input, "utf8");
            const output = await fixture.api.transformTtsc(
              input, source, fixture.options, undefined, deniedCache,
            );
            assert.notEqual(source, cachedCode);
            assert.equal(output?.code, cachedCode);
            assert.equal(deniedCache.get(fixture.key), ready);
          }
          assert.equal(Object.hasOwn(cached.externalInputSignatures ?? {}, unreadable), false,
            "successful deliveries still cannot promote unreadable content to a signature");
          deniedCache.delete(fixture.key);
        }
        denied = false;
        assert.deepEqual(contentMetadata(), nativeMetadata);
        assert.deepEqual(fs.readFileSync(unreadable), nativeBytes);
        const attempts = [compilerGraphInputProofFailures(cached), compilerGraphInputProofFailures(cached)];
        for (const attempt of attempts) {
          assert.deepEqual(attempt.entries, contentChanged);
          assert.equal(attempt.omitted, 0);
        }
        const terminal = createUnstableGenerationError(root, attempts, {
          cached, declaredInputs: undefined,
          inputStates: captureFailedGenerationInputStates(cached, attempts[0]!),
          projectInputHashes: snapshot.hashes,
          projectWalkComplete: walkSnapshotComplete(snapshot, undefined),
          projectWalkFailures: projectWalkFailureFingerprint(snapshot, undefined, root, identities),
        });
        const line = '    - graph/content-changed: ' + JSON.stringify(relative(unreadable));
        assert.equal(terminal.message, [
          "ttsc: could not capture a reusable transform generation after 2 attempts.",
          "  project: " + JSON.stringify(root),
          "  attempt 1:", line, "  attempt 2:", line,
          "  Stop writes to the listed inputs before compilation, or fix the producer that omitted or contradicted the listed proof.",
        ].join("\n"));
        const owner: Promise<TtscCachedProjectTransform> = Promise.reject(terminal);
        void owner.catch(() => undefined);
        deniedCache.set(fixture.key, owner);
        for (let wave = 0; wave < 2; ++wave) {
          const settled = await Promise.allSettled(moduleFiles.map((input) =>
            fixture.api.transformTtsc(input, fs.readFileSync(input, "utf8"), fixture.options, undefined, deniedCache)));
          for (const entry of settled) {
            assert.equal(entry.status, "rejected");
            assert.equal((entry as PromiseRejectedResult).reason, terminal);
          }
          assert.equal(deniedCache.get(fixture.key), owner);
        }
        assert.equal(result.graph?.inputHashes?.[relative(unreadable)], recordedHash,
          "readability changes cannot rewrite the producer's recorded hash");
      } finally {
        resetTtscTransformCache(deniedCache);
        TRANSFORM_RESULT_FILESYSTEM.delete(result);
      }
    }
    for (const mode of ["missing-content", "producer-candidate", "external-output"] as const) {
      const result: ITtscCompilerTransformation.ISuccess = {
        type: "success",
        typescript: Object.fromEntries([...moduleFiles, ...(mode === "external-output" ? externalFiles : [])]
          .map((file) => [relative(file), fs.readFileSync(file, "utf8")])),
        ...(mode === "external-output" ? {} : { graph: {
          edges: Object.fromEntries(moduleNames.map((name) => [name, mode === "missing-content" ? dependencyNames : []])),
          globals: [], configs: [],
          inputHashes: Object.fromEntries(moduleFiles.map((file) => [relative(file), sha(file)])),
          inputRealpaths: Object.fromEntries(moduleFiles.map((file) => [relative(file), fs.realpathSync.native(file)])),
          ...(mode === "missing-content"
            ? { inputProofFailures: Object.fromEntries(dependencyNames.map((name) => [name, "content-unavailable" as const])) }
            : { candidates: { [moduleNames[0]!]: [relative(candidate)] },
                inputObservations: { [relative(candidate)]: { fileExists: false } },
                inputProofFailures: { [relative(candidate)]: "file-exists-changed" as const } }),
        } }),
      };
      const cached: TtscCachedProjectTransform = {
        result, projectRoot: root, tsconfig: path.join(root, "tsconfig.json"),
        membershipPolicy: fixture.good.membershipPolicy, inputHashes: {},
      };
      TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
      try {
        const identities = envelopeDerivation(cached).identityContext;
        const snapshot = collectProjectInputSnapshot(root, identities, filesystem, undefined, { policy: cached.membershipPolicy });
        assert.equal(snapshot.complete, true);
        cached.inputHashes = snapshot.hashes;
        cached.projectDirectories = snapshot.projectDirectories;
        cached.projectSnapshotComplete = true;
        cached.externalInputPaths = mode === "external-output" ? externalFiles : mode === "missing-content" ? dependencies : [candidate];
        const collect = () => mode === "external-output"
          ? captureExternalInputSnapshot(cached, externalFiles, undefined).failures
          : compilerGraphInputProofFailures(cached);
        const attempts = [collect(), collect()];
        const first = attempts[0]!;
        if (mode === "missing-content") {
          assert.deepEqual(first.entries, dependencies.slice(0, 8).map((file) => ({
            domain: "graph", kind: "proof-missing", detail: "content-unavailable", path: file,
          })));
          assert.equal(first.omitted, 4);
        } else if (mode === "producer-candidate") {
          assert.deepEqual(first.entries, [{ domain: "graph", kind: "proof-missing",
            detail: "file-exists-changed", path: candidate }]);
          assert.equal(first.omitted, 0);
        } else {
          assert.deepEqual(first.entries, externalFiles.map((file) => ({
            domain: "external", kind: "graph-proof-missing", detail: undefined, path: file,
          })));
          assert.equal(first.omitted, 0);
        }
        const validation = { cached, declaredInputs: undefined,
          inputStates: captureFailedGenerationInputStates(cached, first),
          projectInputHashes: snapshot.hashes,
          projectWalkComplete: walkSnapshotComplete(snapshot, undefined),
          projectWalkFailures: projectWalkFailureFingerprint(snapshot, undefined, root, identities) };
        const terminal = createUnstableGenerationError(root, attempts, validation);
        const witnessLines = mode === "missing-content"
          ? dependencyNames.slice(0, 8).map((name) => '    - graph/proof-missing: ' + JSON.stringify(name) + ' (producer: "content-unavailable")')
          : mode === "producer-candidate"
            ? ['    - graph/proof-missing: ' + JSON.stringify(relative(candidate)) + ' (producer: "file-exists-changed")']
            : externalFiles.map((file) => '    - external/graph-proof-missing: ' + JSON.stringify(relative(file)));
        const omitted = mode === "missing-content" ? ['    - ... 4 additional witness(es) omitted'] : [];
        assert.equal(terminal.message, [
          "ttsc: could not capture a reusable transform generation after 2 attempts.",
          "  project: " + JSON.stringify(root),
          "  attempt 1:", ...witnessLines, ...omitted,
          "  attempt 2:", ...witnessLines, ...omitted,
          "  Stop writes to the listed inputs before compilation, or fix the producer that omitted or contradicted the listed proof.",
        ].join("\n"));
        const owner: Promise<TtscCachedProjectTransform> = Promise.reject(terminal);
        void owner.catch(() => undefined);
        cache.set(fixture.key, owner);
        const deliveries = mode === "external-output" ? [moduleFiles[0]!, ...externalFiles, moduleFiles[1]!] : moduleFiles;
        const deliver = (file: string) => fixture.api.transformTtsc(file,
          fs.readFileSync(file, "utf8") + (file === fixture.file ? "// in-memory overlay\n" : ""),
          fixture.options, undefined, cache);
        for (let wave = 0; wave < 2; wave++) {
          const settled = await Promise.allSettled(deliveries.map(deliver));
          for (const entry of settled) {
            assert.equal(entry.status, "rejected");
            assert.equal((entry as PromiseRejectedResult).reason, terminal);
          }
          assert.equal(cache.get(fixture.key), owner);
        }
        assert.equal(replaysTerminalGeneration(terminal, 1, { ...props,
          currentSource: fs.readFileSync(fixture.file, "utf8") }), false, "a later explicit pass permits a new attempt");
        await new Promise<void>((resolve) => setImmediate(resolve));
        const editedInput = mode === "external-output" ? externalFiles[0]!
          : mode === "missing-content" ? dependencies[0]! : candidate;
        const previousBytes = fs.existsSync(editedInput) ? fs.readFileSync(editedInput) : undefined;
        try {
          fs.writeFileSync(editedInput, "export const actually_changed = 2;\n");
          assert.equal(replaysTerminalGeneration(terminal, undefined, { ...props,
            currentSource: fs.readFileSync(fixture.file, "utf8") }), false,
            "changed exact proof input authorizes retry without executing a new capture");
          assert.equal(cache.get(fixture.key), owner, "selection alone does not fabricate a replacement owner");
        } finally {
          if (previousBytes === undefined) fs.unlinkSync(editedInput);
          else fs.writeFileSync(editedInput, previousBytes);
        }
        cache.delete(fixture.key);
        assert.equal(cache.has(fixture.key), false, "explicit owner removal withdraws this retained verdict");
      } finally {
        TRANSFORM_RESULT_FILESYSTEM.delete(result);
      }
    }
  } finally {
    resetTtscTransformCache(cache);
    fixture.dispose();
  }
}
