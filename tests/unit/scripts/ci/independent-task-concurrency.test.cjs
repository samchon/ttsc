const assert = require("node:assert/strict");
const { test } = require("node:test");
const { runIndependent } = require("../../../../scripts/ci/run-independent.cjs");

/**
 * Verifies independent workers bound concurrency and collect ordered failures.
 *
 * A deliberately held first task makes completion order differ from input order.
 *
 * 1. Release the held task from a later worker and record the active population.
 * 2. Assert ordered failures, successful empty work and rejection of invalid limits.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls runIndependent with gated tasks and asserts every task starts, failures retain input order and active work never exceeds the requested two workers.
 * @evidence contracts/testing.md#independent-expectations Tasks zero and two explicitly return failure; the literal failure list follows their inputs, while a separate counter measures concurrency instead of reading scheduler state.
 * @evidence contracts/testing.md#distinguishing-cases A blocked first task and successful later tasks distinguish input ordering from completion ordering; empty and all-success work return no failures, while zero workers must reject.
 * @evidence contracts/testing.md#execution-ownership The exported test_independent_task_concurrency is registered once with Node; callbacks and gates run in the same process with no native build or child host.
 */
const test_independent_task_concurrency = async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let active = 0;
  let maximum = 0;
  const started = [];
  const result = runIndependent(
    [0, 1, 2, 3],
    async (task) => {
      started.push(task);
      maximum = Math.max(maximum, ++active);
      try {
        if (task === 0) await gate;
        if (task === 3) release();
        return task === 0 || task === 2 ? 1 : 0;
      } finally {
        --active;
      }
    },
    2,
  );
  assert.deepEqual(await result, [0, 2]);
  assert.deepEqual(started, [0, 1, 2, 3]);
  assert.equal(maximum, 2);
  assert.deepEqual(await runIndependent([], () => 0, 2), []);
  assert.deepEqual(await runIndependent([0, 1], () => 0, 1), []);
  await assert.rejects(
    runIndependent([0], () => 0, 0),
    /positive integer/,
  );
};

module.exports = { test_independent_task_concurrency };

test("workers collect ordered failures", test_independent_task_concurrency);
