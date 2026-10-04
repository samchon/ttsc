import assert from "node:assert/strict";

import { selectTransformAttemptDisposition } from "../../../../../packages/unplugin/src/core/transform/generation/selectTransformAttemptDisposition";
import type { TtscGenerationProofFailures } from "../../../../../packages/unplugin/src/core/transform/generation/TtscGenerationProofFailures";

/**
 * Verifies attempt admission and bounded retry distinguish lost knowledge from
 * a moving project or a refuted publication.
 *
 * The actual transform loop uses this operation to classify capture facts.
 * These authored facts exercise that classification without producing a
 * compiler result or asserting that a native capture established the facts.
 *
 * 1. Contrast coherent success/current diagnostics with incomplete success,
 *    and preserve the independent incomplete-diagnostic fresh flag.
 * 2. Allow fresh local delivery only for lossless, exclusively unavailable
 *    host observations; contrast adoption, mutation and missing proof.
 * 3. Distinguish learned facts, refuted publications and moving windows, then
 *    require the movement and absolute caps to choose diagnostics or terminal.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production selectTransformAttemptDisposition used by transformProject. Literal admission/fresh-only/retry/diagnostic/terminal rows check precedence, unavailable-host qualification, learned-fact versus movement accounting, rejected publication state and both retry caps.
 * @evidence contracts/testing.md#independent-expectations Coherent reusable success needs a complete project snapshot, while current diagnostics may be returned without it. Missing knowledge/refuted publication does not establish movement; loss or mixed evidence cannot excuse it. Literal moved counts, state strings and cap positions are authored from these distinctions, not calculated by the selector.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts success/failure/exception, true/false/unknown proof, observations incomplete versus named host failures, local versus adopted unavailable proof, empty/mixed/omitted learned facts, refuted versus nonrefuted publication, two movement failures versus four knowledge attempts and diagnostic config coherence versus unavailable config. Retained failure aggregates preserve exact identity and input contents.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit calls the actual in-process operation with caller-owned proof facts. No compiler, session, native observer, peer or external host runs. Dependency union/case-policy carry, capture assembly, disposal and terminal error rendering remain caller responsibilities and are not certified by this classification unit.
 */
export function test_transform_attempt_disposition_preserves_retry_and_terminal_policy(): void {
  type Input = Parameters<typeof selectTransformAttemptDisposition>[0];
  const movement: TtscGenerationProofFailures = {
    entries: [{ domain: "project", kind: "input-content-changed", path: "src/main.ts" }],
    omitted: 0,
    seen: new Set(["movement-witness"]),
  };
  const learned: TtscGenerationProofFailures = {
    entries: [
      { domain: "external", kind: "dependency-unwitnessed", path: "types.d.ts" },
      { domain: "project", kind: "case-policy-learned" },
    ],
    omitted: 0,
    seen: new Set(["dependency-witness", "case-witness"]),
  };
  const unavailable: TtscGenerationProofFailures = {
    entries: [{ domain: "host", kind: "observation-unavailable", path: "plugin.cjs" }],
    omitted: 0,
    seen: new Set(["host-witness"]),
  };
  const base: Input = {
    resultType: "success",
    configStateComplete: true,
    projectSnapshotComplete: false,
    projectHeldStill: false,
    hostInputProofFailureCount: 0,
    failures: movement,
    attempt: 0,
    moved: 0,
    rejected: "earlier-publication",
  };
  const choose = (change: Partial<Input> = {}) =>
    selectTransformAttemptDisposition({ ...base, ...change });

  for (const [name, change, expected] of [
    ["complete success", { projectSnapshotComplete: true }, { kind: "accepted", freshDeliveryOnly: false }],
    ["current failure", { resultType: "failure", projectHeldStill: true }, { kind: "accepted", freshDeliveryOnly: false }],
    ["legacy current exception", { resultType: "exception", projectHeldStill: undefined, configStateComplete: undefined }, { kind: "accepted", freshDeliveryOnly: false }],
    ["incomplete failure observations", { resultType: "failure", projectHeldStill: true, observationsComplete: false }, { kind: "accepted", freshDeliveryOnly: true }],
    ["named failure host proof", { resultType: "failure", projectHeldStill: true, hostInputProofFailureCount: 1 }, { kind: "accepted", freshDeliveryOnly: true }],
    ["exception is not failure envelope", { resultType: "exception", projectHeldStill: true, observationsComplete: false, hostInputProofFailureCount: 1 }, { kind: "accepted", freshDeliveryOnly: false }],
    ["coherent admission precedes failed aggregate", { projectSnapshotComplete: true, failures: unavailable, adopted: { state: "publication", refuted: true } }, { kind: "accepted", freshDeliveryOnly: false }],
  ] satisfies Array<[string, Partial<Input>, { kind: string; freshDeliveryOnly: boolean }]>) {
    assert.deepEqual(choose(change), expected, name);
  }
  for (const [name, change] of [
    ["unknown success snapshot", { projectSnapshotComplete: undefined }],
    ["incoherent configuration", { projectSnapshotComplete: true, configStateComplete: false }],
    ["diagnostics from a moving window", { resultType: "failure", projectHeldStill: false }],
  ] satisfies Array<[string, Partial<Input>]>) assert.equal(choose(change).kind, "retry", name);

  assert.deepEqual(choose({ projectHeldStill: true, failures: unavailable }),
    { kind: "fresh-only", freshDeliveryOnly: true }, "local host unavailability transfers only fresh delivery");
  for (const [name, change] of [
    ["adoption cannot become local fresh output", { adopted: { state: "publication", refuted: false } }],
    ["unknown config", { configStateComplete: undefined }],
    ["unknown project stability", { projectHeldStill: undefined }],
    ["omitted failure", { failures: { ...unavailable, omitted: 1 } }],
    ["empty failure", { failures: { entries: [], omitted: 0, seen: new Set<string>() } }],
    ["mixed movement", { failures: { ...unavailable, entries: [...unavailable.entries, ...movement.entries] } }],
    ["wrong domain", { failures: { ...unavailable, entries: [{ domain: "graph", kind: "observation-unavailable" }] } }],
    ["different host failure", { failures: { ...unavailable, entries: [{ domain: "host", kind: "input-content-changed" }] } }],
  ] satisfies Array<[string, Partial<Input>]>) assert.equal(choose({ projectHeldStill: true, failures: unavailable, ...change }).kind, "retry", name);

  for (const [name, change, expectedMoved, expectedRejected] of [
    ["ordinary movement", {}, 1, "earlier-publication"],
    ["learned dependency and case", { failures: learned }, 0, "earlier-publication"],
    ["omitted learned witness", { failures: { ...learned, omitted: 1 } }, 1, "earlier-publication"],
    ["mixed learned and mutation", { failures: { ...learned, entries: [...learned.entries, ...movement.entries] } }, 1, "earlier-publication"],
    ["empty recorded proof", { failures: { entries: [], omitted: 0, seen: new Set<string>() } }, 1, "earlier-publication"],
    ["refuted publication", { adopted: { state: "refuted-state", refuted: true } }, 0, "refuted-state"],
    ["adopted moving window", { adopted: { state: "still-valid-state", refuted: false } }, 1, "earlier-publication"],
    ["adopted learned window", { adopted: { state: "still-valid-state", refuted: false }, failures: learned }, 0, "earlier-publication"],
  ] satisfies Array<[string, Partial<Input>, number, string]>) {
    const input: Partial<Input> = change;
    const actual = choose(input);
    assert.equal(actual.kind, "retry", name);
    assert.ok("moved" in actual);
    assert.equal(actual.moved, expectedMoved, name);
    assert.equal(actual.rejected, expectedRejected, name);
    assert.equal(actual.failures, input.failures ?? movement, "supplied aggregate is retained exactly");
    assert.equal(actual.freshDeliveryOnly, false, name);
  }
  const missing = choose({ failures: undefined });
  assert.equal(missing.kind, "retry");
  assert.ok("failures" in missing);
  assert.deepEqual(missing.failures.entries, []);
  assert.equal(missing.failures.omitted, 0);
  assert.deepEqual([...missing.failures.seen], []);

  for (const [name, change, kind, moved, fresh] of [
    ["second movement success", { moved: 1 }, "terminal", 2, false],
    ["second movement diagnostics", { moved: 1, resultType: "failure", observationsComplete: false }, "diagnostic", 2, true],
    ["second movement exception", { moved: 1, resultType: "exception", configStateComplete: undefined }, "diagnostic", 2, false],
    ["diagnostics cannot excuse bad config", { moved: 1, resultType: "failure", configStateComplete: false }, "terminal", 2, false],
    ["third knowledge attempt", { attempt: 2, failures: learned }, "retry", 0, false],
    ["fourth knowledge attempt", { attempt: 3, failures: learned }, "terminal", 0, false],
    ["fourth refuted publication", { attempt: 3, adopted: { state: "last-refuted", refuted: true } }, "terminal", 0, false],
    ["fourth diagnostic knowledge attempt", { attempt: 3, failures: learned, resultType: "failure" }, "diagnostic", 0, false],
  ] satisfies Array<[string, Partial<Input>, string, number, boolean]>) {
    const actual = choose(change);
    assert.equal(actual.kind, kind, name);
    assert.ok("moved" in actual);
    assert.equal(actual.moved, moved, name);
    assert.equal(actual.freshDeliveryOnly, fresh, name);
  }
  assert.deepEqual(movement.entries, [{ domain: "project", kind: "input-content-changed", path: "src/main.ts" }]);
  assert.deepEqual([...movement.seen], ["movement-witness"]);
  assert.equal(movement.omitted, 0);
  assert.deepEqual(learned.entries, [
    { domain: "external", kind: "dependency-unwitnessed", path: "types.d.ts" },
    { domain: "project", kind: "case-policy-learned" },
  ]);
  assert.deepEqual([...learned.seen], ["dependency-witness", "case-witness"]);
  assert.equal(learned.omitted, 0);
  assert.deepEqual(unavailable.entries, [
    { domain: "host", kind: "observation-unavailable", path: "plugin.cjs" },
  ]);
  assert.deepEqual([...unavailable.seen], ["host-witness"]);
  assert.equal(unavailable.omitted, 0);
  assert.equal(base.moved, 0);
  assert.equal(base.attempt, 0);
  assert.equal(base.rejected, "earlier-publication");
}
