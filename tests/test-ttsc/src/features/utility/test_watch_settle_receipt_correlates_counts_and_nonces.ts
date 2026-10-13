import assert from "node:assert/strict";

import { WatchSettleReceipt } from "../../../../utils/src/WatchSettleReceipt";

/**
 * Verifies idle receipts correlate nonces and drain independent output counts.
 *
 * The actual watch harness uses this portable owner for both pipe orders.
 *
 * 1. Ignore unrelated messages and reject malformed matching cumulative counts.
 * 2. Deliver an idle receipt before stdout and require all completed markers.
 * 3. Drain completions beyond an older receipt and include outstanding starts.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the receipt owner and the completion-draining orchestration used by startWatch; assertions require available completions beyond an acknowledged count to be consumed and outstanding starts to invalidate an earlier idle boundary.
 * @evidence contracts/testing.md#independent-expectations The public settle protocol binds id to cumulative completed builds; all acknowledged markers must be consumed, and a newer cycle cannot be certified by an earlier idle receipt. Expected outcomes follow these count relationships rather than implementation output.
 * @evidence contracts/testing.md#distinguishing-cases Covers no request, empty and unrelated messages, wrong type and nonce, zero builds, missing/string/fractional/negative/unsafe counts, counts predating the request, both pipe orders, exact equality and superseded nonce replies. One available delivery contains completions beyond the acknowledged count; the adjacent delivery ends at that count with a newer outstanding start, whose completion then requires a fresh receipt. Observation callback failure preserves its original error.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc runner discovers this direct portable unit; it calls the harness's actual receipt owner with authored messages and integer observations without processes, stream impersonation, filesystem setup or compiler builds.
 */
export function test_watch_settle_receipt_correlates_counts_and_nonces(): void {
  const receipt = new WatchSettleReceipt();
  assert.equal(receipt.evaluate(0), "pending");
  assert.equal(
    receipt.accept({ type: "ttsc.watch.settled", id: "unknown", builds: 0 }),
    false,
  );
  const first = receipt.request(0);
  assert.equal(first.type, "ttsc.watch.settle");
  assert.ok(first.id.length > 0);
  for (const foreign of [
    null,
    undefined,
    "noise",
    {},
    { type: "ttsc.watch.stopped", id: first.id, builds: 0 },
    { type: "ttsc.watch.settled", id: "another-request", builds: "invalid" },
  ]) {
    assert.equal(receipt.accept(foreign), false);
    assert.equal(receipt.evaluate(0), "pending");
  }
  for (const builds of [
    undefined,
    null,
    "0",
    -1,
    0.5,
    Infinity,
    NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () =>
        receipt.accept({ type: "ttsc.watch.settled", id: first.id, builds }),
      /invalid settled build count/,
    );
    assert.equal(receipt.evaluate(0), "pending");
  }
  assert.equal(
    receipt.accept({ type: "ttsc.watch.settled", id: first.id, builds: 0 }),
    true,
  );
  assert.equal(receipt.evaluate(0), "idle");

  const second = receipt.request(2);
  assert.notEqual(second.id, first.id);
  assert.equal(receipt.evaluate(2), "pending");
  assert.throws(
    () =>
      receipt.accept({ type: "ttsc.watch.settled", id: second.id, builds: 1 }),
    /invalid settled build count/,
  );
  assert.equal(
    receipt.accept({ type: "ttsc.watch.settled", id: second.id, builds: 4 }),
    true,
  );
  assert.equal(receipt.evaluate(2), "pending");
  assert.equal(receipt.evaluate(3), "pending");
  assert.equal(receipt.evaluate(4), "idle");
  assert.equal(receipt.evaluate(5), "renew");

  const third = receipt.request(5);
  assert.notEqual(third.id, second.id);
  assert.equal(
    receipt.accept({ type: "ttsc.watch.settled", id: second.id, builds: 6 }),
    false,
  );
  assert.equal(receipt.evaluate(6), "pending");
  assert.equal(
    receipt.accept({ type: "ttsc.watch.settled", id: third.id, builds: 5 }),
    true,
  );
  assert.equal(receipt.evaluate(6), "renew");

  const final = receipt.request(6);
  assert.equal(
    receipt.accept({ type: "ttsc.watch.settled", id: final.id, builds: 6 }),
    true,
  );
  assert.equal(receipt.evaluate(6), "idle");

  const delivered = new WatchSettleReceipt();
  let consumed = 2;
  let started = false;
  const available = [3, 4, 5];
  const seen: number[] = [];
  const observation = {
    next: (): number | null => available.shift() ?? null,
    consume: (build: number): void => {
      ++consumed;
      seen.push(build);
    },
    consumed: (): number => consumed,
    started: (): boolean => started,
  };
  const earlier = delivered.request(consumed);
  delivered.accept({ type: "ttsc.watch.settled", id: earlier.id, builds: 4 });
  assert.equal(delivered.observe(observation), "renew");
  assert.equal(consumed, 5);
  assert.deepEqual(seen, [3, 4, 5]);
  assert.deepEqual(available, new Array<number>());

  const adjacent = new WatchSettleReceipt();
  consumed = 3;
  seen.length = 0;
  available.push(4);
  started = true;
  const precedingStart = adjacent.request(consumed);
  adjacent.accept({
    type: "ttsc.watch.settled",
    id: precedingStart.id,
    builds: 4,
  });
  assert.equal(adjacent.observe(observation), "renew");
  assert.equal(consumed, 4);
  assert.deepEqual(seen, [4]);
  const coveringStart = adjacent.request(consumed);
  adjacent.accept({
    type: "ttsc.watch.settled",
    id: coveringStart.id,
    builds: 5,
  });
  assert.equal(adjacent.observe(observation), "pending");
  started = false;
  available.push(5);
  assert.equal(adjacent.observe(observation), "idle");
  assert.deepEqual(seen, [4, 5]);

  const observationFailure = new Error(
    "The build observation rejected excess work",
  );
  assert.throws(
    () =>
      adjacent.observe({
        next: () => 6,
        consume: () => {
          throw observationFailure;
        },
        consumed: () => 5,
        started: () => false,
      }),
    (error: unknown) => error === observationFailure,
  );
}
