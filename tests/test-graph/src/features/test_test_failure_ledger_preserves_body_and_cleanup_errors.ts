import assert from "node:assert/strict";

import { TestFailureLedger } from "../../../utils/src/TestFailureLedger";

/**
 * Verifies original body and cleanup reasons survive independent attempts.
 *
 * Cleanup must continue after an earlier throw, and primitive equality cannot prove that two failing operations reported the same occurrence.
 *
 * 1. Contrast empty completion with a single thrown undefined and one Error.
 * 2. Run owned cleanup callbacks after body failure and preserve their order.
 * 3. Preserve equal primitive occurrences while deduplicating reference reports.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual shared ledger runs authored synchronous cleanup callbacks, preserves thrown undefined as failure, continues later cleanup and reports the single original or ordered AggregateError used by the config-recovery scene.
 * @evidence contracts/testing.md#independent-expectations Authored callbacks throw literal values or separately allocated reason references; the expected call order and aggregate entries follow those operations, not ledger snapshots or source arrangement.
 * @evidence contracts/testing.md#distinguishing-cases Empty success, single undefined, single Error, body plus cleanup failures, later successful cleanup, equal undefined/string/null/NaN occurrences, repeated Error/object/function references and distinct equivalent objects remain separate outcomes. TestLifetime units own clock/disposer behavior and E2E owns actual topology closure and native retirement.
 * @evidence contracts/testing.md#execution-ownership This discoverable test-graph unit calls the shared source ledger with test-owned synchronous callbacks; it changes no product, filesystem, observer, environment or timer and starts no native process.
 */
export function test_test_failure_ledger_preserves_body_and_cleanup_errors(): void {
  const empty = new TestFailureLedger();
  let successfulCleanups = 0;
  empty.capture(() => { ++successfulCleanups; });
  empty.throwIfFailed("empty completion");
  assert.equal(successfulCleanups, 1);

  const missingReason = new TestFailureLedger();
  missingReason.capture(() => { throw undefined; });
  let missingReasonThrew = false;
  try {
    missingReason.throwIfFailed("single undefined");
  } catch (reason) {
    missingReasonThrew = true;
    assert.equal(reason, undefined);
  }
  assert.equal(missingReasonThrew, true, "undefined remains a thrown failure");

  const single = new TestFailureLedger();
  const original = new Error("one original observation");
  single.capture(() => { throw original; });
  single.add(original);
  assert.throws(() => single.throwIfFailed("single Error"), (reason) => reason === original);

  const ordered = new TestFailureLedger();
  const calls: string[] = [];
  const bodyReason = { owner: "body" };
  const closeReason = new Error("original topology close");
  const finishReason = new Error("original lifetime disposal");
  try {
    calls.push("body");
    throw bodyReason;
  } catch (reason) {
    ordered.add(reason);
  }
  ordered.capture(() => { calls.push("close"); throw closeReason; });
  ordered.capture(() => { calls.push("finish"); throw finishReason; });
  ordered.capture(() => { calls.push("later cleanup"); });
  ordered.add(closeReason);
  assert.deepEqual(calls, ["body", "close", "finish", "later cleanup"]);
  assert.throws(() => ordered.throwIfFailed("ordered cleanup"), (reason) => {
    assert.ok(reason instanceof AggregateError);
    assert.deepEqual(reason.errors, [bodyReason, closeReason, finishReason]);
    assert.equal(reason.errors[0], bodyReason);
    assert.equal(reason.errors[1], closeReason);
    assert.equal(reason.errors[2], finishReason);
    return true;
  });

  const repeated = new TestFailureLedger();
  const objectReason = { owner: "same reference" };
  const distinctObject = { owner: "same reference" };
  const functionReason = () => undefined;
  repeated.capture(() => { throw undefined; });
  repeated.capture(() => { throw undefined; });
  repeated.capture(() => { throw "same primitive"; });
  repeated.capture(() => { throw "same primitive"; });
  repeated.capture(() => { throw null; });
  repeated.capture(() => { throw null; });
  repeated.capture(() => { throw NaN; });
  repeated.capture(() => { throw NaN; });
  repeated.capture(() => { throw objectReason; });
  repeated.add(objectReason);
  repeated.capture(() => { throw distinctObject; });
  repeated.capture(() => { throw functionReason; });
  repeated.add(functionReason);
  assert.throws(() => repeated.throwIfFailed("primitive occurrences"), (reason) => {
    assert.ok(reason instanceof AggregateError);
    assert.deepEqual(reason.errors, [
      undefined, undefined, "same primitive", "same primitive", null, null,
      NaN, NaN, objectReason, distinctObject, functionReason,
    ]);
    assert.equal(reason.errors[8], objectReason);
    assert.equal(reason.errors[9], distinctObject);
    assert.equal(reason.errors[10], functionReason);
    return true;
  });
}
