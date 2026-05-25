package linthost

import "testing"

// TestFormatPrintWidthReflowsCallWithNestedObjectArgument verifies a
// call whose last argument is an object literal reflows with the object
// hugging the parens while a nested object member is preserved
// verbatim.
//
// The object printer reflows the outer brace layout but emits each
// member (a PropertyAssignment) verbatim — the dispatcher has no
// member-level printer. A nested object that fits on one source line is
// therefore carried through unchanged, which is reflow-safe: a
// single-line verbatim slice has no interior column to strand. The case
// pins two things at once — last-argument hugging keeps `register(` on
// one line, and the verbatim member round-trips byte-identical instead
// of being corrupted.
//
//  1. Feed `register("svc", { name: …, opts: { … } });` mis-indented
//     across several lines so the outer object must be reflowed.
//  2. Run formatPrintWidth at printWidth=30.
//  3. Assert the object hugs the parens, its members align at a
//     two-space indent, and the single-line nested object survives
//     verbatim.
func TestFormatPrintWidthReflowsCallWithNestedObjectArgument(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "formatPrintWidth",
    "register(\"svc\", {\n      name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
    `{"printWidth": 30}`,
    "register(\"svc\", {\n  name: \"alpha\",\n  opts: { retries: 3, timeout: 1000 },\n});\n",
  )
}
