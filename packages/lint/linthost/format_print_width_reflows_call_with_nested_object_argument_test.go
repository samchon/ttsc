package linthost

import "testing"

// TestFormatPrintWidthReflowsCallWithNestedObjectArgument verifies a call whose
// last argument is an object literal reflows with the object hugging the
// parens, and that a nested object too wide for the budget breaks with it.
//
// The independently authored output fixes both outer indentation and
// the nested object layout. Its flat opts line is 38 columns, exceeding
// width 30; TestFormatPrintWidthKeepsNestedObjectThatFits uses the same
// source at width 80 and keeps that nested object flat. This body does
// not execute an earlier dispatcher or an external formatter.
//
//  1. Feed `register("svc", { name: …, opts: { … } });` mis-indented across
//     several lines so the outer object must be reflowed.
//  2. Run formatPrintWidth at printWidth=30.
//  3. Assert the object hugs the parens and the over-wide nested object breaks
//     under it, both matching the oracle.
//
// @evidence contracts/testing.md#behavioral-verification format/print-width must fix the outer object indentation and break its nested opts object at width thirty.
// @evidence contracts/testing.md#independent-expectations The full expected source is independently authored for the supported width-thirty layout; it retains the svc argument, property names and numeric values while changing only layout.
// @evidence contracts/testing.md#distinguishing-cases The changed width-thirty case complements the identical source at width eighty, where the nested object must remain flat.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthReflowsCallWithNestedObjectArgument is a registered format/print-width rule unit. The snapshot harness calls the owning rule through the Go engine and applies real edits to isolated fixture source. It retains this case identity and does not start a consumer or native product host.
func TestFormatPrintWidthReflowsCallWithNestedObjectArgument(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "register(\"svc\", {\n      name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
    `{"printWidth": 30}`,
    "register(\"svc\", {\n  name: \"alpha\",\n  opts: {\n    retries: 3,\n    timeout: 1000,\n  },\n});\n",
  )
}
