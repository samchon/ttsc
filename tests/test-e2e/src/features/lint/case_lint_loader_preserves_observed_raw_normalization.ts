import assert from "node:assert/strict";
import fs from "node:fs";
import { TextDecoder } from "node:util";

import type { TraceMeasurements } from "../../internal/readE2eTraceMeasurements";
import { readE2eTracePayload } from "../../internal/readE2eTracePayload";

/**
 * Verifies actual executable-config bytes reach native normalization and cache.
 *
 * The shared consumer owns the real command/resident request and joined phase.
 * This scene consumes its observation instead of running a new evaluator for
 * each private field. Literal expectations come from the authored profile.
 *
 * 1. Require every expected actual loader invocation in the selected phase.
 * 2. Decode its original raw result and compare native normalization/cache rows.
 * 3. Where the profile applies a fix, read the actual file and its literal output.
 *
 * @evidence contracts/testing.md#behavioral-verification Same writer/invocation joins actual Run result, captured result-file bytes, accepted native normalization and cache outcomes. Optional fix rows read actual disk output after the owning native operation, without supplying an evaluator response.
 * @evidence contracts/testing.md#independent-expectations Profile-authored value/dependency/cache arrays and complete fixed text are independent expected literals. Raw and normalized dependencies have separate expectations because normalization may default or order fields; trace values do not generate either oracle.
 * @evidence contracts/testing.md#distinguishing-cases Expected evaluation count distinguishes cold/disabled/unstable re-evaluation from silent cache reuse. Actual raw bytes, accepted normalization and observed cache outcomes stay distinct; zero evaluations cannot certify a loader connection.
 * @evidence contracts/testing.md#execution-ownership Callable scene is not yet registered or executed. Shared consumer owns requests, prepared configs and actual writer/child joins. Direct format/cache policy units remain separate and this body is not their execution proof.
 * @evidence contracts/e2e.md#necessary-boundary Actual JS/TS loader result-file transport into the Go normalizer may lose raw option ordering or dependency information; direct Go parsing policy does not exercise that process/file connection.
 * @evidence contracts/e2e.md#shared-execution Reads the already-run consumer's bounded captures and output. Starts no extra process, Program or installation and preserves every expected evaluation as a separate actual invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Caller uses the phase cursor, fixed prepared config inputs and joins writers before reading. Cache outcome memory-published is not proof of successful disk persistence; Cmd.Run return is not arbitrary descendant closure. Root and output cleanup remain caller-owned.
 * @evidence contracts/e2e.md#preserved-coverage Raw option/config and dependency fields plus real normalization/cache/fixed output remain observable separately from direct private policy owners. Original donors, actual selection/runtime and survival proof remain pending; no synthetic envelope replaces the wire capture.
 */
export function case_lint_loader_preserves_observed_raw_normalization(
  traceRoot: string,
  traces: TraceMeasurements,
  expected: {
    writerPid: number;
    location: string;
    label: string;
    evaluations: readonly {
      value: unknown;
      rawDependencies: readonly unknown[];
      normalizedDependencies: readonly unknown[];
      cacheOutcomes: readonly string[];
    }[];
    fixedOutputs: readonly { file: string; text: string }[];
  },
): void {
  assert.deepEqual(traces.integrityProblems, []);
  assert.ok(expected.evaluations.length > 0, "real loader connection requires evaluation");
  const results = traces.writerObservations.map(row => row.observation).filter(row =>
    row.writerPid === expected.writerPid && row.event === "config-loader-result" &&
    row.data?.location === expected.location && row.data?.label === expected.label)
    .sort((left, right) => left.sequence - right.sequence);
  assert.equal(results.length, expected.evaluations.length);
  for (const [index, result] of results.entries()) {
    const oracle = expected.evaluations[index]!;
    const paired = traces.writerObservations.map(row => row.observation).filter(row =>
      row.writerPid === result.writerPid && row.instance === result.instance && row.invocation === result.invocation);
    const attempts = paired.filter(row => row.event === "process-attempt");
    const processes = paired.filter(row => row.event === "process-result");
    assert.equal(attempts.length, 1);
    assert.equal(processes.length, 1);
    const process = processes[0]!;
    assert.ok(attempts[0]!.sequence < process.sequence && process.sequence < result.sequence);
    assert.equal(process.data?.owner, "lint-config-loader");
    assert.ok(typeof process.pid === "number" && process.pid > 0);
    assert.equal(process.data?.started, true);
    assert.equal(process.data?.exitObserved, true);
    assert.equal(process.data?.exitCode, 0);
    assert.equal(process.data?.success, true);
    assert.equal(result.data?.readOutcome, "complete");
    assert.equal(result.data?.normalizationAttempted, true);
    assert.equal(result.data?.normalizationAccepted, true);
    assert.equal(result.data?.dependenciesTracked, true);
    assert.equal(result.data?.success, true);
    const capture = readE2eTracePayload(traceRoot, result, result.data?.raw);
    const envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(capture.bytes)) as {
      value: unknown;
      dependencies: unknown[];
    };
    assert.deepEqual(envelope.value, oracle.value);
    assert.deepEqual(envelope.dependencies, oracle.rawDependencies);
    assert.deepEqual(result.data?.dependencies, oracle.normalizedDependencies);
    const caches = paired.filter(row => row.event === "config-cache-outcome")
      .sort((left, right) => left.sequence - right.sequence);
    assert.deepEqual(caches.map(row => row.data?.outcome), oracle.cacheOutcomes);
    for (const cache of caches) {
      assert.ok(cache.sequence > result.sequence);
      assert.equal(cache.data?.location, expected.location);
    }
  }
  for (const output of expected.fixedOutputs)
    assert.equal(fs.readFileSync(output.file, "utf8"), output.text);
}
