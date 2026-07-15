package linthost

import "testing"

// TestFormatPrintWidthInsertsAfterNonRestObjectAssignmentTarget is the
// target-axis over-suppression twin for the reflow: a preserved multi-line
// object assignment target WITHOUT a trailing rest (`({ a, b } = obj)`) must
// still gain its trailing comma.
//
// The printer must suppress the comma only when the target ends in a rest,
// not on every destructuring target. This pins that a plain `{ a, b } = obj`
// reflow still appends the comma so the guard does not disable trailing
// commas across all assignment targets.
//
// 1. Feed an already-broken object assignment target whose last member is not a rest.
// 2. Run formatPrintWidth at the default width (objectWrap keeps it expanded).
// 3. Assert the reflow adds the trailing comma after the last member.
func TestFormatPrintWidthInsertsAfterNonRestObjectAssignmentTarget(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/print-width",
    "({\n  a,\n  b\n} = obj);\n",
    "({\n  a,\n  b,\n} = obj);\n",
  )
}
