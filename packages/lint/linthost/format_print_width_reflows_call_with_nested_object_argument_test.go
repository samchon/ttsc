package linthost

import "testing"

// TestFormatPrintWidthReflowsCallWithNestedObjectArgument verifies a call whose
// last argument is an object literal reflows with the object hugging the
// parens, and that a nested object too wide for the budget breaks with it.
//
// This case used to require the opposite of its second half. The dispatcher had
// no member-level printer, so `printObjectLiteral` emitted every
// PropertyAssignment through `verbatim` and a nested object was frozen at
// whatever width the source wrote it — the expectation recorded that gap as the
// requirement, and this comment described the freezing as reflow-safe. It is
// reflow-safe; it is also not what Prettier does.
//
// Measured on the pinned Prettier 3.8.3 with this exact input: at printWidth 30
// the nested object breaks, because `  opts: { retries: 3, timeout: 1000 },` is
// 38 columns; at printWidth 80 it stays flat. So the old expectation was the
// right answer to a different width, produced for the wrong reason.
//
//  1. Feed `register("svc", { name: …, opts: { … } });` mis-indented across
//     several lines so the outer object must be reflowed.
//  2. Run formatPrintWidth at printWidth=30.
//  3. Assert the object hugs the parens and the over-wide nested object breaks
//     under it, both matching the oracle.
//
// @evidence contracts/testing.md#behavioral-verification format/print-width must fix the outer object indentation and break its nested opts object at width thirty.
// @evidence contracts/testing.md#independent-expectations The full expected source was measured independently on pinned Prettier 3.8.3; it retains the svc argument, property names and numeric values while changing only layout.
// @evidence contracts/testing.md#distinguishing-cases The changed width-thirty case complements the identical source at width eighty, where the nested object must remain flat.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthReflowsCallWithNestedObjectArgument is a public format unit selected by the lint semantic-unit Evidence claim. The snapshot harness calls the owning rule through the Go engine and applies real edits to isolated fixture source. It retains this case identity and does not start a consumer or native product host.
func TestFormatPrintWidthReflowsCallWithNestedObjectArgument(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "register(\"svc\", {\n      name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
    `{"printWidth": 30}`,
    "register(\"svc\", {\n  name: \"alpha\",\n  opts: {\n    retries: 3,\n    timeout: 1000,\n  },\n});\n",
  )
}
