const assert = require("node:assert/strict");
const { test } = require("node:test");
const { runIndependent } = require("./run-independent.cjs");

test("workers collect ordered failures", async () => {
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
  await assert.rejects(
    runIndependent([0], () => 0, 0),
    /positive integer/,
  );
});
