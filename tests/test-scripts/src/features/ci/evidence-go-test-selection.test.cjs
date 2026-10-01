const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  selectEvidenceGoTests,
} = require("../../../../../scripts/ci/evidence-go-test-selection.cjs");

/**
 * Verifies named Go cases retain one source identity and one execution owner.
 *
 * The original rule tests and transferred parser boundaries share a compiled
 * package, so the runner must select their actual layer without dropping cases
 * or invoking another layer's function merely because it compiles beside them.
 *
 * 1. Classify authored unit, E2E and Windows function declarations.
 * 2. Require exact case names and their original source identities.
 * 3. Reject duplicate identities and an unrecognized layer before execution.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls selectEvidenceGoTests on authored declaration inputs, asserting each layer's exact named cases and source mapping while TestMain and non-test functions remain outside the ordinary case population.
 * @evidence contracts/testing.md#independent-expectations The fixture explicitly assigns its three source records to unit, E2E and Windows and defines literal Go Test names; expected names and ownership do not come from the selector's output or the repository's current file layout.
 * @evidence contracts/testing.md#distinguishing-cases A multiline Test signature and TestMain in one unit input contrast with ordinary non-test declarations, a transferred E2E case and a Windows-only case. Duplicate Test identities and an unknown layer fail instead of silently choosing one producer or dropping a population.
 * @evidence contracts/testing.md#execution-ownership This single named Node unit is discovered by the central tooling unit lane; it exercises the authored classifier in process using source records as inputs, and starts no Go compiler, installed consumer or product host. Actual generated Go-wrapper execution belongs to the existing Go population runners.
 */
function test_evidence_go_selection_preserves_case_ownership() {
  const inputs = [
    {
      file: "unit_test.go",
      source:
        "func TestUnit(\n t *testing.T,\n) {}\nfunc TestMain(m *testing.M) {}\nfunc helper() {}\n",
      layer: "unit",
    },
    {
      file: "bridge_test.go",
      source: "func TestBridge(t *testing.T) {}\n",
      layer: "e2e",
    },
    {
      file: "alias_windows_test.go",
      source: "func TestWindowsAlias(t *testing.T) {}\n",
      layer: "windows",
    },
  ];
  assert.deepEqual(selectEvidenceGoTests(inputs), {
    unit: ["TestUnit"],
    e2e: ["TestBridge"],
    windows: ["TestWindowsAlias"],
    sources: {
      TestUnit: "unit_test.go",
      TestBridge: "bridge_test.go",
      TestWindowsAlias: "alias_windows_test.go",
    },
  });
  assert.throws(
    () =>
      selectEvidenceGoTests([
        ...inputs,
        { file: "duplicate_test.go", source: inputs[0].source, layer: "e2e" },
      ]),
    /duplicate Evidence Go test: TestUnit/,
  );
  assert.throws(
    () => selectEvidenceGoTests([{ ...inputs[0], layer: "unowned" }]),
    /unknown Evidence Go test layer: unowned/,
  );
}

exports.test_evidence_go_selection_preserves_case_ownership =
  test_evidence_go_selection_preserves_case_ownership;

test(
  "Evidence Go cases retain their source and execution owner",
  test_evidence_go_selection_preserves_case_ownership,
);
