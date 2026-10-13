import assert from "node:assert/strict";

import { WatchSettlement } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchSettlement";

/**
 * Verifies watch settlement waits for actual work and rechecks async decisions.
 *
 * Explicit barriers keep queued work pending without an elapsed-time oracle.
 *
 * 1. Resolve an idle owner and hold queued, running and asynchronous work.
 * 2. Change the revision during an idle query and require another observation.
 * 3. Wake concurrent waits and reject terminal or failed owner observations.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production settlement owner with controlled state and async barriers; assertions require pending scheduling work to prevent completion and transitions during a query to invalidate that query.
 * @evidence contracts/testing.md#independent-expectations An owner is idle only after its authored queued, running and decision states finish; a terminal Error must remain the same rejection object. No time, output snapshot or implementation-derived value defines success.
 * @evidence contracts/testing.md#distinguishing-cases Covers immediate idle, queued-to-running work, concurrent waits, a revision changed inside an async idle query, query rejection and shutdown while awaiting a transition. Explicit barriers hold silence indefinitely without relying on machine speed.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc feature runner discovers this portable unit; it directly imports the authored settlement class and creates only promises and mutable owner state, without processes, watchers, compilers or filesystem setup.
 */
export async function test_watch_settlement_waits_for_owner_state(): Promise<void> {
  const state = new WatchSettlement();
  let publications = 0;
  await state.wait(
    async () => true,
    () => {
      ++publications;
    },
  );
  assert.equal(publications, 1);

  let queued = true;
  let running = false;
  let queries = 0;
  let completed = 0;
  const idle = async (): Promise<boolean> => {
    ++queries;
    return !queued && !running;
  };
  const first = state.wait(idle).then(() => ++completed);
  const second = state.wait(idle).then(() => ++completed);
  await Promise.resolve();
  assert.equal(completed, 0);
  assert.equal(queries, 2);
  queued = false;
  running = true;
  state.changed();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(completed, 0);
  running = false;
  state.changed();
  await Promise.all([first, second]);
  assert.equal(completed, 2);

  const asynchronous = new WatchSettlement();
  const decisions: ((idle: boolean) => void)[] = [];
  let accepted = false;
  const delayed = asynchronous
    .wait(
      () =>
        new Promise<boolean>((resolve) => {
          decisions.push(resolve);
        }),
    )
    .then(() => {
      accepted = true;
    });
  assert.equal(decisions.length, 1);
  asynchronous.changed();
  decisions[0]!(true);
  await Promise.resolve();
  assert.equal(accepted, false);
  assert.equal(decisions.length, 2);
  decisions[1]!(true);
  await delayed;
  assert.equal(accepted, true);

  const terminal = new WatchSettlement();
  const original = new Error("Owner closed with queued work");
  let closed = false;
  const pending = terminal.wait(async () => {
    if (closed) throw original;
    return false;
  });
  await Promise.resolve();
  closed = true;
  terminal.changed();
  await assert.rejects(pending, (error: unknown) => error === original);
  terminal.changed();
  await assert.rejects(
    terminal.wait(async () => {
      throw original;
    }),
    (error: unknown) => error === original,
  );
  await assert.rejects(
    terminal.wait(
      async () => true,
      async () => {
        throw original;
      },
    ),
    (error: unknown) => error === original,
  );
}
