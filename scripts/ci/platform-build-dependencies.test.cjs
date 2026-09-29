const assert = require("node:assert/strict");
const { test } = require("node:test");
const { finishPlatformBuilds } = require("../build-platforms.cjs");

test("platform failures finish every target and block only dependent graph work", async () => {
  for (const broken of ["foreign", "current"]) {
    const called = [];
    const failed = await finishPlatformBuilds(
      ["foreign", "current", "last"],
      async (target) => {
        called.push(target);
        return target === broken ? 1 : 0;
      },
      "current",
      () => called.push("graph"),
      2,
    );
    assert.deepEqual(failed, [broken]);
    assert.deepEqual(called.slice(0, 3), ["foreign", "current", "last"]);
    assert.equal(called.includes("graph"), broken !== "current");
  }
});
