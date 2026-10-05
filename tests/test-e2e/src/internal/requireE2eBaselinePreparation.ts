import assert from "node:assert/strict";
import path from "node:path";

import {
  type PreparedAssetSelection,
  captureE2ePreparedAssets,
} from "./captureE2ePreparedAssets";
import type { TracePhaseObservation } from "./captureE2eTracePhase";

/**
 * Requires an actual legacy observation and its unchanged selected preparation.
 * This synchronous guard does not run a baseline or authenticate caller data.
 * It observes current explicit files and rejects incompatible retained producer
 * identities before a shared-consumer callback; observation is not a freeze.
 *
 * @evidence contracts/common.md#principled-implementation Checks completed actual legacy callback metadata, fixed trace root, observation integrity and explicit before/after/current producer path/hash/native identity. Nonzero measured legacy status remains a failure outcome, not baseline PASS.
 * @evidence contracts/common.md#clear-and-simple-design One guard owns baseline admission for callable families. Caller supplies the baseline and independent producer-label correspondence; source observation delegates to the existing prepared-asset owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not create a receipt, execute a probe, infer loaded images from hashes or accept semantic success as whole trace completeness. Supplied metadata is not cryptographic provenance, and a native snapshot does not freeze externally mutable files.
 * @evidence contracts/common.md#meaningful-documentation Separates baseline admission, selected file compatibility, unobserved population and later actual callback/cleanup responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation Uses the fixed absolute native trace root and existing observed native path/metadata fields. No OS-name equality or capability fallback is invented.
 * @evidence contracts/performance.md#efficient-algorithms Reads only explicitly selected producer bytes once through captureE2ePreparedAssets and compares finite baseline observations by label. Nested label lookups cost selected current labels times retained baseline labels; no workspace scan or subprocess is started.
 * @evidence contracts/performance.md#reuse-equivalent-work Reuses the actual retained legacy observation but observes current producer files anew rather than trusting stale bytes. Each subsequent profile still owns its own before/after interval.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Delegated synchronous reads close before return and current metadata is local. The caller retains baseline/trace roots and owns actual writers, callbacks and cleanup; no process or persistent resource is acquired here.
 */
export function requireE2eBaselinePreparation(
  baseline: TracePhaseObservation<unknown>,
  traceRoot: string,
  producerAssets: readonly PreparedAssetSelection[],
  producerLabels: Readonly<Record<string, string>>,
): void {
  assert.ok(path.isAbsolute(traceRoot));
  assert.equal(process.env.TTSC_E2E_TRACE, traceRoot);
  assert.equal(baseline.traceRoot, traceRoot);
  assert.equal(baseline.label, "legacy-baseline");
  assert.equal(baseline.outcome.returned, true);
  assert.deepEqual(baseline.observationErrors, []);
  assert.ok(baseline.traces && baseline.assetsAfter);
  assert.deepEqual(baseline.traces.integrityProblems, []);
  assert.deepEqual(baseline.traces.incompleteProcessInvocations, []);
  const measured = baseline.outcome.returned
    ? baseline.outcome.value
    : undefined;
  assert.ok(measured !== null && typeof measured === "object");
  const returned = measured as {
    pid?: unknown;
    status?: unknown;
    signal?: unknown;
  };
  assert.ok(
    typeof returned.pid === "number" &&
      Number.isSafeInteger(returned.pid) &&
      returned.pid > 0,
  );
  assert.ok(
    typeof returned.status === "number" && Number.isInteger(returned.status),
  );
  assert.equal(returned.signal, null);
  assert.ok(producerAssets.length > 0);
  assert.deepEqual(
    Object.keys(producerLabels).sort(),
    producerAssets.map((asset) => asset.label).sort(),
  );
  const prepared = captureE2ePreparedAssets(producerAssets);
  for (const asset of prepared) {
    const label = producerLabels[asset.label]!;
    const before = baseline.assetsBefore.filter((item) => item.label === label);
    const after = baseline.assetsAfter.filter((item) => item.label === label);
    assert.equal(before.length, 1, `baseline producer ${label}`);
    assert.equal(after.length, 1, `baseline producer ${label}`);
    assert.equal(before[0]!.sha256, after[0]!.sha256);
    assert.equal(before[0]!.realPath, after[0]!.realPath);
    assert.deepEqual(before[0]!.identityAfter, after[0]!.identityBefore);
    assert.equal(asset.requestedPath, after[0]!.requestedPath);
    assert.equal(asset.realPath, after[0]!.realPath);
    assert.equal(asset.sha256, after[0]!.sha256);
    assert.deepEqual(asset.identityBefore, after[0]!.identityAfter);
  }
}
