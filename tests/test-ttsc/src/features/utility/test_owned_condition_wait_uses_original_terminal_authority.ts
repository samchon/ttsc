import assert from "node:assert/strict";

import { waitFor } from "../../../../utils/src/internal/waitFor";

/**
 * Verifies condition observations use publication and their original owner.
 *
 * An observation may remain legitimately pending. Its real predicate, terminal
 * check and AbortSignal supply results while cancellation leaves underlying
 * work separately owned.
 *
 * 1. Keep an observation pending, then publish its independently owned condition.
 * 2. Contrast delivered-before-close with an unmet condition at terminal failure.
 * 3. Preserve actual predicate/check errors and cancel before or during work.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual common waitFor operation with owned publication, error and AbortController boundaries; no elapsed interval supplies a result.
 * @evidence contracts/testing.md#independent-expectations Literal publication state and original thrown objects supply success/failure expectations. Error causes retain the exact original values, while cancelling observation cannot settle the separately owned predicate work.
 * @evidence contracts/testing.md#distinguishing-cases Pending-to-published and publication-before-later-close contrast with unmet publication at producer failure. Synchronous/asynchronous predicate errors, undefined throw, pre-abort and in-flight abort preserve separate failure/cancellation paths; concrete predicates own publication qualification.
 * @evidence contracts/testing.md#execution-ownership This portable unit imports the actual common test operation and controls only its own callbacks, promises and AbortController. It launches no process, host, compiler, installer or native producer.
 */
export async function test_owned_condition_wait_uses_original_terminal_authority(): Promise<void> {
  let publish = false;
  let observed!: () => void;
  const firstInspection = new Promise<void>((resolve) => { observed = resolve; });
  let completed = false;
  const publication = waitFor(() => {
    observed();
    return publish;
  }, "authored publication").then(() => { completed = true; });
  await firstInspection;
  assert.equal(completed, false);
  publish = true;
  await publication;
  assert.equal(completed, true);

  let delivered = false;
  let producerClosed = false;
  let enteredPublication!: () => void;
  const waitingPublication = new Promise<void>((resolve) => { enteredPublication = resolve; });
  const laterClose = new Error("producer closed after delivery");
  const deliveredBeforeClose = waitFor(() => {
    enteredPublication();
    return delivered;
  }, "publication before original close", { check: () => {
    if (producerClosed) throw laterClose;
  } });
  await waitingPublication;
  delivered = true;
  producerClosed = true;
  await deliveredBeforeClose;

  const unqualifiedFailure = new Error("publication belongs to failed producer");
  const stalePublication = true;
  const publicationQualified = false;
  await assert.rejects(waitFor(
    () => stalePublication && publicationQualified,
    "unqualified publication",
    { check: () => { throw unqualifiedFailure; } },
  ), (error: Error) => error.cause === unqualifiedFailure);

  const predicateError = new Error("original predicate failure");
  await assert.rejects(waitFor(() => { throw predicateError; }, "predicate"),
    (error: Error) => error.cause === predicateError);
  const asyncError = new Error("original asynchronous failure");
  await assert.rejects(waitFor(async () => { throw asyncError; }, "async predicate"),
    (error: Error) => error.cause === asyncError);
  const ownerError = new Error("original producer closed");
  let inspected = false;
  await assert.rejects(waitFor(() => { inspected = true; return false; }, "owner", {
    check: () => { throw ownerError; },
  }), (error: Error) => error.cause === ownerError);
  assert.equal(inspected, true);
  const checkAbort = new AbortController();
  const checkCancellation = new Error("owner cancelled during terminal inspection");
  let checkInspections = 0;
  await assert.rejects(waitFor(() => { checkInspections++; return false; },
    "terminal-check cancellation", {
      signal: checkAbort.signal,
      check: () => checkAbort.abort(checkCancellation),
    }), (error: Error) => error.cause === checkCancellation);
  assert.equal(checkInspections, 1);
  await assert.rejects(waitFor(() => { throw undefined; }, "undefined predicate"),
    (error: Error) => Object.hasOwn(error, "cause") && error.cause === undefined);

  const aborted = new AbortController();
  const before = new Error("cancel before admission");
  aborted.abort(before);
  await assert.rejects(waitFor(() => { assert.fail("pre-abort must refuse inspection"); },
    "pre-abort", { signal: aborted.signal }), (error: Error) => error.cause === before);

  const pending = new AbortController();
  let entered!: () => void;
  let finish!: (value: boolean) => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const work = new Promise<boolean>((resolve) => { finish = resolve; });
  let underlyingCompleted = false;
  const observedWork = work.then((value) => { underlyingCompleted = true; return value; });
  const observation = waitFor(() => { entered(); return observedWork; },
    "pending predicate", { signal: pending.signal });
  await started;
  const cancellation = new Error("actual pending cancellation");
  pending.abort(cancellation);
  await assert.rejects(observation, (error: Error) => error.cause === cancellation);
  assert.equal(underlyingCompleted, false);
  finish(true);
  await observedWork;
  assert.equal(underlyingCompleted, true);
}
