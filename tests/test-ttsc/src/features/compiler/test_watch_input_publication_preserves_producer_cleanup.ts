import assert from "node:assert/strict";

import { WatchInputPublication } from "../../../../../packages/ttsc/src/compiler/internal/build/WatchInputPublication";

/**
 * Verifies publication failure reaches suspended producer cleanup.
 *
 * The completion runner must preserve generator exception and finally behavior
 * rather than abandon a producer when a handler rejects or returns a promise.
 *
 * 1. Suspend an authored producer at two independently controlled handoffs.
 * 2. Reject the second handoff and assert its catch and finally both execute.
 * 3. Contrast synchronous success, refusal and a throwing then accessor.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual completion runners advance the authored producer only after each handoff and deliver failures into its catch/finally path; exact event order detects premature reads and abandoned cleanup.
 * @evidence contracts/testing.md#independent-expectations Authored gates and literal event order express the generator and callback completion contracts independently of the runners' implementation.
 * @evidence contracts/testing.md#distinguishing-cases Pending first and second handoffs, recovered rejection, synchronous empty completion, promise refusal, an inaccessible then property and an unrecovered failure exercise successful, negative and cleanup paths. Product input discovery and native ownership belong to the separate build and watch tests.
 * @evidence contracts/testing.md#execution-ownership This exported unit invokes the portable completion owner with in-memory generators and promises only; it acquires no filesystem handle, native artifact or process.
 */
export async function test_watch_input_publication_preserves_producer_cleanup(): Promise<void> {
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const secondStarted = Promise.withResolvers<void>();
  const failure = new Error("handoff failed");
  const events: string[] = [];
  void second.promise.catch(() => {});
  function* producer(): WatchInputPublication.Sequence<string> {
    try {
      events.push("first");
      yield first.promise;
      events.push("read-first");
      secondStarted.resolve();
      yield second.promise;
      events.push("read-second");
      return "built";
    } catch (error) {
      assert.equal(error, failure);
      events.push("failed");
      return "refused";
    } finally {
      events.push("released");
    }
  }
  const operation = WatchInputPublication.runAsync(producer());
  try {
    assert.deepEqual(events, ["first"]);
    await Promise.resolve();
    assert.deepEqual(events, ["first"]);
    first.resolve();
    await secondStarted.promise;
    assert.deepEqual(events, ["first", "read-first"]);
    second.reject(failure);
    assert.equal(await operation, "refused");
    assert.deepEqual(events, ["first", "read-first", "failed", "released"]);
  } finally {
    first.resolve();
    second.reject(failure);
    await operation;
  }

  const successful: string[] = [];
  function* syncProducer(): WatchInputPublication.Sequence<number> {
    try {
      yield undefined;
      successful.push("read");
      return 7;
    } finally {
      successful.push("released");
    }
  }
  assert.equal(WatchInputPublication.run(syncProducer()), 7);
  assert.deepEqual(successful, ["read", "released"]);
  for (const completion of [
    Promise.reject(failure),
    {
      get then(): never {
        throw failure;
      },
    } as unknown as Promise<void>,
  ]) {
    let released = false;
    function* refusedProducer(): WatchInputPublication.Sequence<void> {
      try {
        yield completion;
        assert.fail("refused completion must not resume the producer");
      } finally {
        released = true;
      }
    }
    assert.throws(
      () => WatchInputPublication.run(refusedProducer()),
      completion instanceof Promise
        ? /asynchronous build entry/
        : (error) => error === failure,
    );
    assert.equal(released, true);
  }
  let released = false;
  function* rejectedProducer(): WatchInputPublication.Sequence<void> {
    try {
      yield Promise.reject(failure);
    } finally {
      released = true;
    }
  }
  await assert.rejects(
    WatchInputPublication.runAsync(rejectedProducer()),
    (error) => error === failure,
  );
  assert.equal(released, true);
}
