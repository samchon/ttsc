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
 * 4. Await the actual body/cleanup owner API and continue after independent refusals.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual shared ledger runs authored synchronous cleanup callbacks, preserves thrown undefined as failure, continues later cleanup and reports the single original or ordered AggregateError used by its E2E consumers. The actual run API awaits authored body and cleanup operations, retains prior scenario causes and continues later cleanup after synchronous or asynchronous refusal.
 * @evidence contracts/testing.md#independent-expectations Authored callbacks throw literal values or separately allocated reason references; the expected call order and aggregate entries follow those operations, not ledger snapshots or source arrangement.
 * @evidence contracts/testing.md#distinguishing-cases Empty success, single undefined, single Error, body plus cleanup failures, later successful cleanup, equal undefined/string/null/NaN occurrences, repeated Error/object/function references and distinct equivalent objects remain separate outcomes. The run boundary additionally distinguishes successful empty cleanup, body-only failure, cleanup-only failure and prior scenario plus asynchronous body/cleanup failures. TestLifetime units own clock/disposer behavior and E2E owns actual topology closure and native retirement; authored refusals do not reproduce historical filesystem EPERM.
 * @evidence contracts/testing.md#execution-ownership This discoverable test-graph unit calls the shared source ledger with test-owned synchronous and asynchronous callbacks; it changes no product, filesystem, observer, environment or timer and starts no native process.
 */
export async function test_test_failure_ledger_preserves_body_and_cleanup_errors(): Promise<void> {
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

  const operation = new TestFailureLedger();
  const operationCalls: string[] = [];
  const scenarioCause = { owner: "original scenario" };
  const scenarioFailure = new Error("authored scenario name", { cause: scenarioCause });
  operation.add(scenarioFailure);
  const operationBody = { owner: "async body" };
  const synchronousCleanup = new Error("synchronous final cleanup");
  const asynchronousCleanup = new Error("asynchronous final cleanup");
  await assert.rejects(operation.run(async () => {
    operationCalls.push("body started");
    await Promise.resolve();
    operationCalls.push("body refused");
    throw operationBody;
  }, [
    () => { operationCalls.push("synchronous cleanup"); throw synchronousCleanup; },
    async () => {
      operationCalls.push("asynchronous cleanup started");
      await Promise.resolve();
      operationCalls.push("asynchronous cleanup refused");
      throw asynchronousCleanup;
    },
    () => { operationCalls.push("later cleanup"); },
  ], "operation and final cleanup"), (reason: unknown) => {
    assert.ok(reason instanceof AggregateError);
    assert.deepEqual(reason.errors, [scenarioFailure, operationBody, synchronousCleanup, asynchronousCleanup]);
    assert.equal(reason.errors[0], scenarioFailure);
    assert.equal(reason.errors[0].cause, scenarioCause);
    assert.equal(reason.errors[1], operationBody);
    assert.equal(reason.errors[2], synchronousCleanup);
    assert.equal(reason.errors[3], asynchronousCleanup);
    return true;
  });
  assert.deepEqual(operationCalls, ["body started", "body refused", "synchronous cleanup", "asynchronous cleanup started", "asynchronous cleanup refused", "later cleanup"]);

  let emptyBodyCalls = 0;
  await new TestFailureLedger().run(() => { ++emptyBodyCalls; }, [], "empty cleanup list");
  assert.equal(emptyBodyCalls, 1);
  let successfulFinalCleanup = 0;
  await new TestFailureLedger().run(async () => undefined, [
    async () => { await Promise.resolve(); ++successfulFinalCleanup; },
  ], "successful final cleanup");
  assert.equal(successfulFinalCleanup, 1);
  let capturedCleanupCalls = 0;
  const capturedCleanups = [() => { ++capturedCleanupCalls; }];
  await new TestFailureLedger().run(() => { capturedCleanups.length = 0; }, capturedCleanups, "captured final capabilities");
  assert.equal(capturedCleanupCalls, 1, "body mutation cannot withdraw admitted final cleanup");
  const bodyOnly = new Error("body-only refusal");
  let bodyOnlyCleanup = 0;
  await assert.rejects(new TestFailureLedger().run(() => { throw bodyOnly; }, [
    () => { ++bodyOnlyCleanup; },
  ], "body-only failure"), (reason) => reason === bodyOnly);
  assert.equal(bodyOnlyCleanup, 1);
  const cleanupOnly = { owner: "cleanup-only refusal" };
  let cleanupOnlyLater = 0;
  await assert.rejects(new TestFailureLedger().run(async () => undefined, [
    async () => { throw cleanupOnly; },
    () => { ++cleanupOnlyLater; },
  ], "cleanup-only failure"), (reason) => reason === cleanupOnly);
  assert.equal(cleanupOnlyLater, 1);
  let undefinedOperationThrew = false;
  try {
    await new TestFailureLedger().run(async () => { throw undefined; }, [], "single undefined operation");
  } catch (reason) {
    undefinedOperationThrew = true;
    assert.equal(reason, undefined);
  }
  assert.equal(undefinedOperationThrew, true, "an asynchronous undefined refusal remains failure");
  await assert.rejects(new TestFailureLedger().run(async () => { throw undefined; }, [
    () => { throw undefined; },
  ], "independent undefined refusals"), (reason: unknown) => {
    assert.ok(reason instanceof AggregateError);
    assert.deepEqual(reason.errors, [undefined, undefined]);
    return true;
  });
}
