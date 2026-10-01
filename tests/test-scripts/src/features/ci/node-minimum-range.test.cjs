const assert = require("node:assert/strict");
const { test } = require("node:test");
const { nodeFloor } = require("../../../../../scripts/ci/validation-suites.cjs");

/**
 * Verifies Node floor parsing admits only a complete supported lower bound.
 *
 * A partial or compound range cannot determine the one runtime used by CI.
 *
 * 1. Parse complete bounds with and without separator whitespace.
 * 2. Reject missing, partial, exact, caret and compound range forms.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls nodeFloor on fixture engine ranges and compares the extracted version or required rejection, detecting accidental acceptance of ranges without a unique complete floor.
 * @evidence contracts/testing.md#independent-expectations Literal versions are the three numeric components authored in the supported lower-bound fixture; rejected forms come from the parser's documented single-bound contract.
 * @evidence contracts/testing.md#distinguishing-cases Two valid whitespace variants contrast with absent engines, partial versions, exact and caret ranges, and a lower bound carrying an additional upper bound.
 * @evidence contracts/testing.md#execution-ownership Node invokes the exported test_node_minimum_range once and calls the range parser directly; fixture package objects are inputs rather than assertions about the repository manifest.
 */
const test_node_minimum_range = () => {
  for (const [range, version] of [[">=24.1.2", "24.1.2"], [">= 22.15.0", "22.15.0"]])
    assert.equal(nodeFloor({ engines: { node: range } }), version);
  for (const range of [undefined, "22.15.0", ">=22", "^22.15.0", ">=22.15.0 <27"])
    assert.throws(() => nodeFloor({ engines: { node: range } }), /engines.node/);
};

module.exports = { test_node_minimum_range };

test("the supported Node minimum accepts only a complete lower bound", test_node_minimum_range);
