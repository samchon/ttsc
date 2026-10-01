package linthost

import "testing"

// TestFormatPrintWidthKeepsNestedObjectThatFits is the negative twin the case
// above lacked: the same source at a width the nested object fits within keeps
// it on one line, so the break is width-driven and not a consequence of the
// member printer existing.
//
// Expected output measured on the pinned Prettier 3.8.3.
//
// @evidence contracts/testing.md#behavioral-verification format/print-width must repair the outer indentation while leaving the nested opts object flat at width eighty.
// @evidence contracts/testing.md#independent-expectations The expected source is the independent Prettier 3.8.3 literal, retaining both option values and their original property order.
// @evidence contracts/testing.md#distinguishing-cases The same input at thirty columns breaks the nested object in the paired reflow case, distinguishing a budget-driven decision from unconditional breaking.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsNestedObjectThatFits is a public format unit selected by TestSelectedLintUnits. The snapshot harness calls the owning rule through the Go engine and applies real edits to isolated fixture source. It retains this case identity and does not start a consumer or native product host.
func TestFormatPrintWidthKeepsNestedObjectThatFits(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "register(\"svc\", {\n      name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
    `{"printWidth": 80}`,
    "register(\"svc\", {\n  name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
  )
}
