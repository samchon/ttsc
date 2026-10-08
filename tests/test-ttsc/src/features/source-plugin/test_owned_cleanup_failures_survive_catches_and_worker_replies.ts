import assert from "node:assert/strict";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { serializeCompilerError } from "../../../../../packages/ttsc/src/internal/serializeCompilerError";
import { receiveCapabilityFailure } from "../../../../../packages/ttsc/src/plugin/internal/receiveCapabilityFailure";

/**
 * Verifies cleanup refusals survive discovery catches and worker transport.
 *
 * A requested abort or an ignored lookup rejection cannot certify clean owner
 * shutdown when an owned resource refused release. Ordinary discovery failure
 * remains distinct, while failed deferred cleanup must retain its FIFO retry.
 *
 * 1. Catch immediate and deferred cleanup refusals under the actual task scope.
 * 2. Require original error identity in the task ledger and exact FIFO retry.
 * 3. Receive real compiler-error serialization with marked and ordinary replies,
 *    retaining only marked failures regardless of their error name.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls maintained release/recover, OwnedSynchronousProcess.run, serializeCompilerError and receiveCapabilityFailure, asserting original failure references, FIFO attempts, restored aggregate causes and parent-ledger retention independently of caller rejection.
 * @evidence contracts/testing.md#independent-expectations Resource cleanup refusal must prevent a clean shutdown even when its immediate caller catches it; a semantic discovery error alone cannot imply resource loss. Literal callback order and original error references establish those expectations without deriving snapshots from implementation output.
 * @evidence contracts/testing.md#distinguishing-cases Immediate versus deferred refusal, failed retry versus subsequent success, marked aggregate versus unmarked legacy/false-marked discovery errors and an AbortError-named cleanup failure distinguish ownership from request semantics. Actual cold native supervision and worker packaging remain in the installed E2E population.
 * @evidence contracts/testing.md#execution-ownership One discoverable unit entry invokes owning operations with caller-owned callbacks, scopes and ledgers in one process. It starts no worker/native compiler or installed consumer and replaces no foreign method; explicit no-resource boundary classification tests policy without claiming kernel retirement.
 */
export function test_owned_cleanup_failures_survive_catches_and_worker_replies(): void {
  const immediate = new Error("authored immediate resource refusal");
  const deferred = new Error("authored deferred resource refusal");
  const failures: unknown[] = [];
  const order: string[] = [];
  OwnedSynchronousProcess.run(
    { cancel: new SharedArrayBuffer(4), failures },
    () => {
      assert.throws(
        () => SourceNativeRetirement.release(() => { throw immediate; }),
        (error) => error === immediate,
      );
      assert.deepEqual(failures, [immediate]);
      const scope = SourceNativeRetirement.createScope("owned-cleanup-policy");
      let attempts = 0;
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.begin("boundary");
        SourceNativeRetirement.settle("boundary", "unknown", "authored unresolved boundary");
        SourceNativeRetirement.release(() => {
          order.push("first");
          if (++attempts === 1) throw deferred;
        });
        SourceNativeRetirement.release(() => { order.push("second"); });
      });
      assert.deepEqual(order, []);
      assert.throws(
        () => SourceNativeRetirement.recover(scope, "boundary", "joined"),
        (error) => error === deferred,
      );
      assert.deepEqual(failures, [immediate, deferred]);
      assert.equal(scope.deferred.length, 2);
      assert.deepEqual(order, ["first"]);
      SourceNativeRetirement.recover(scope, "boundary", "joined");
      assert.deepEqual(order, ["first", "first", "second"]);
      assert.equal(scope.deferred.length, 0);
      assert.deepEqual(failures, [immediate, deferred]);
    },
  );
  const parent: Error[] = [];
  const aggregate = new AggregateError([immediate, deferred], "worker cleanup refused", { cause: immediate });
  const marked = receiveCapabilityFailure(
    { thrown: serializeCompilerError(aggregate), ownershipFailed: true },
    (error) => parent.push(error),
  );
  assert.deepEqual(parent, [marked]);
  assert.ok(marked instanceof AggregateError);
  assert.deepEqual(marked.errors.map((error: Error) => error.message), [immediate.message, deferred.message]);
  assert.equal((marked.cause as Error).message, immediate.message);
  for (const ownershipFailed of [undefined, false]) {
    const ordinary = receiveCapabilityFailure(
      { thrown: serializeCompilerError(new Error("ordinary discovery refusal")), ownershipFailed },
      (error) => parent.push(error),
    );
    assert.equal(ordinary.message, "ordinary discovery refusal");
    assert.deepEqual(parent, [marked]);
  }
  const abortedCleanup = receiveCapabilityFailure(
    { thrown: { name: "AbortError", message: "resource cleanup refused" }, ownershipFailed: true },
    (error) => parent.push(error),
  );
  assert.equal(abortedCleanup.name, "AbortError");
  assert.deepEqual(parent, [marked, abortedCleanup]);
}
