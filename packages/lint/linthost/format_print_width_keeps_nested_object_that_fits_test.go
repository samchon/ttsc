package linthost

import "testing"

// TestFormatPrintWidthKeepsNestedObjectThatFits is the width-preservation
// twin of TestFormatPrintWidthReflowsCallWithNestedObjectArgument. The
// same source keeps its nested object flat when it fits, distinguishing
// the width decision from unconditional member expansion.
//
// The full expected layout is authored independently of the rule output.
//
// @evidence contracts/testing.md#behavioral-verification format/print-width must repair the outer indentation while leaving the nested opts object flat at width eighty.
// @evidence contracts/testing.md#independent-expectations The expected source is an independently authored supported-layout literal, retaining both option values and their original property order.
// @evidence contracts/testing.md#distinguishing-cases The same input at thirty columns breaks the nested object in the paired reflow case, distinguishing a budget-driven decision from unconditional breaking.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsNestedObjectThatFits is a registered format/print-width rule unit. The snapshot harness calls the owning rule through the Go engine and applies real edits to isolated fixture source. It retains this case identity and does not start a consumer or native product host.
func TestFormatPrintWidthKeepsNestedObjectThatFits(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "register(\"svc\", {\n      name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
    `{"printWidth": 80}`,
    "register(\"svc\", {\n  name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
  )
}
