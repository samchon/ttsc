const assert = require("node:assert/strict");
const { test } = require("node:test");
const { nodeFloor } = require("./validation-suites.cjs");

test("the supported Node minimum accepts only a complete lower bound", () => {
  for (const [range, version] of [[">=24.1.2", "24.1.2"], [">= 22.15.0", "22.15.0"]])
    assert.equal(nodeFloor({ engines: { node: range } }), version);
  for (const range of [undefined, "22.15.0", ">=22", "^22.15.0", ">=22.15.0 <27"])
    assert.throws(() => nodeFloor({ engines: { node: range } }), /engines.node/);
});
