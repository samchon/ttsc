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
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the inserts after non rest object assignment target fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the reflow adds the trailing comma after the last member.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed an already-broken object assignment target whose last member is not a rest. The asserted decision is: Assert the reflow adds the trailing comma after the last member. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthInsertsAfterNonRestObjectAssignmentTarget is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthInsertsAfterNonRestObjectAssignmentTarget(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/print-width",
    "({\n  a,\n  b\n} = obj);\n",
    "({\n  a,\n  b,\n} = obj);\n",
  )
}
