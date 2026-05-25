package linthost

import "testing"

// TestFormatPrintWidthKeepsShortCallWithCallbackHugged verifies a call
// whose only argument is a multi-line arrow callback keeps the callback
// hugging the parens — it is reflowed for consistent indentation but
// the argument list is not exploded.
//
// This is the headline corruption fix. Before last-argument hugging and
// the function-body printers landed, `new Singleton(() => { … })` was
// rewritten to garbage: the callback's verbatim body kept its source
// columns while the argument list re-indented around it, so `() =>`
// and the body drifted to different indents. The rule must now produce
// the Prettier-style hugged shape with a body indented exactly two
// spaces under the `=>` header.
//
//  1. Feed a `new` expression whose argument is an arrow callback whose
//     block body is mis-indented in the source.
//  2. Run formatPrintWidth at the default 80-column width.
//  3. Assert the callback hugs the parens and every body line lands at
//     a consistent two-space indent.
func TestFormatPrintWidthKeepsShortCallWithCallbackHugged(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatPrintWidth",
    "const x = new Singleton(\n      () => {\n  doStuff();\n        return 1;\n});\n",
    "const x = new Singleton(() => {\n  doStuff();\n  return 1;\n});\n",
  )
}
