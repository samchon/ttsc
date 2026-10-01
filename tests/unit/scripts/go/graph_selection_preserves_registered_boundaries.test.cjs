const assert = require("node:assert/strict");
const { test } = require("node:test");
const { selectGraphGoTests } = require("../../../../scripts/ci/graph-go-test-selection.cjs");

/**
 * Verifies Graph selection separates registered units from real boundaries.
 *
 * A platform may hide a declaration behind a build tag. Selection must use the
 * registered population while rejecting compiled addresses with no source owner.
 *
 * 1. Select an authored platform population containing one unit and one boundary.
 * 2. Verify each layer and their union retain exactly those registered addresses.
 * 3. Reject unknown addresses, duplicate registrations, empty selections and typos.
 *
 * @evidence contracts/testing.md#behavioral-verification selectGraphGoTests filters registered package/name identities through their owning source layers; it detects an unmapped compiled test instead of omitting its execution.
 * @evidence contracts/testing.md#independent-expectations Explicit fixture identities define one registered unit and boundary while a third declared Windows-only address is absent; expected arrays are literal supported selections, not snapshots of implementation results.
 * @evidence contracts/testing.md#distinguishing-cases Unit, E2E and combined selection retain their respective identities, an unregistered platform declaration stays absent, and unknown or duplicated registration, empty layers and invalid selectors reject.
 * @evidence contracts/testing.md#execution-ownership test_graph_selection_preserves_registered_boundaries is a CommonJS node:test unit export exercising the selector's input domain; fixture registration data is not a claim that Go or any SDK executed.
 */
const test_graph_selection_preserves_registered_boundaries = () => {
  const unit = { package: "internal/graph", name: "TestPortable", file: "unit.go", layer: "unit" };
  const boundary = { package: "cmd/ttscgraph", name: "TestGit", file: "boundary.go", layer: "e2e" };
  const windows = { package: "internal/graph", name: "TestWindows", file: "windows.go", layer: "e2e" };
  const addresses = [unit, boundary, windows];
  const registered = [
    { package: "internal/graph", name: "TestPortable" },
    { package: "cmd/ttscgraph", name: "TestGit" },
  ];
  assert.deepEqual(selectGraphGoTests(addresses, registered, "unit"), [unit]);
  assert.deepEqual(selectGraphGoTests(addresses, registered, "e2e"), [boundary]);
  assert.deepEqual(selectGraphGoTests(addresses, registered), [unit, boundary]);
  assert.throws(() => selectGraphGoTests(addresses, [...registered, registered[0]]), /duplicate registered/);
  assert.throws(() => selectGraphGoTests(addresses, [{ package: "other", name: "TestPortable" }]), /no owning source/);
  assert.throws(() => selectGraphGoTests(addresses, [registered[0]], "e2e"), /ran no cases/);
  assert.throws(() => selectGraphGoTests(addresses, registered, "typo"), /unknown Graph Go test layer/);
};

test("Graph selection preserves registered boundaries", test_graph_selection_preserves_registered_boundaries);
module.exports = { test_graph_selection_preserves_registered_boundaries };
