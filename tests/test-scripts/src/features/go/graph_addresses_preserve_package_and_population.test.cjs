const assert = require("node:assert/strict");
const { test } = require("node:test");
const { graphGoTestAddresses } = require("../../../../../scripts/ci/graph-go-test-selection.cjs");

/**
 * Verifies Go test address discovery preserves package and execution population.
 *
 * A source registry must distinguish equal test names in different packages and
 * reject a duplicate within one package before constructing an exact selector.
 *
 * 1. Discover authored unit and boundary declarations plus a private helper.
 * 2. Compare their package, file and layer identities to independent literals.
 * 3. Reject a duplicate address and an unsupported population.
 *
 * @evidence contracts/testing.md#behavioral-verification graphGoTestAddresses interprets authored Go declarations and exposes the exact package/name/file/layer tuples; duplicate names in one package cannot silently overwrite an execution owner.
 * @evidence contracts/testing.md#independent-expectations Literal tuples follow the fixture declarations and their caller-supplied physical population, rather than deriving an expectation from the parser's output.
 * @evidence contracts/testing.md#distinguishing-cases Equal names across packages are valid, private helpers are not public tests, same-package duplicates fail, and unknown layers fail even for an empty declaration file.
 * @evidence contracts/testing.md#execution-ownership test_graph_addresses_preserve_package_and_population is a CommonJS unit export registered with node:test; it exercises the owning declaration parser without Go compilation, an installed consumer or a product process.
 */
const test_graph_addresses_preserve_package_and_population = () => {
  const inputs = [
    { package: "internal/graph", file: "unit.go", layer: "unit", source: "func TestIdentity(t *testing.T) {}\nfunc privateFixture() {}" },
    { package: "cmd/ttscgraph", file: "boundary.go", layer: "e2e", source: "func TestIdentity(t *testing.T) {}" },
  ];
  assert.deepEqual(graphGoTestAddresses(inputs), [
    { package: "internal/graph", name: "TestIdentity", file: "unit.go", layer: "unit" },
    { package: "cmd/ttscgraph", name: "TestIdentity", file: "boundary.go", layer: "e2e" },
  ]);
  assert.throws(() => graphGoTestAddresses([inputs[0], { ...inputs[0], file: "duplicate.go" }]), /duplicate Graph Go address/);
  assert.throws(() => graphGoTestAddresses([{ ...inputs[0], layer: "unknown", source: "" }]), /unknown Graph Go input layer/);
};

test("Graph addresses preserve package and population", test_graph_addresses_preserve_package_and_population);
module.exports = { test_graph_addresses_preserve_package_and_population };
