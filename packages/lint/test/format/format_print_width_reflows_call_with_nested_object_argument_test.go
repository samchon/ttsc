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
func TestFormatPrintWidthReflowsCallWithNestedObjectArgument(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "register(\"svc\", {\n      name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
    `{"printWidth": 30}`,
    "register(\"svc\", {\n  name: \"alpha\",\n  opts: {\n    retries: 3,\n    timeout: 1000,\n  },\n});\n",
  )
}

// TestFormatPrintWidthKeepsNestedObjectThatFits is the negative twin the case
// above lacked: the same source at a width the nested object fits within keeps
// it on one line, so the break is width-driven and not a consequence of the
// member printer existing.
//
// Expected output measured on the pinned Prettier 3.8.3.
func TestFormatPrintWidthKeepsNestedObjectThatFits(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "register(\"svc\", {\n      name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
    `{"printWidth": 80}`,
    "register(\"svc\", {\n  name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
  )
}
