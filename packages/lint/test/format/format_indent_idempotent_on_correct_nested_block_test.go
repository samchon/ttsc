package linthost

import "testing"

// TestFormatIndentIdempotentOnCorrectNestedBlock verifies the rule emits
// no finding when nested block statements are already correctly indented.
//
// A statement at the right column compares equal to its desired indent
// and must produce nothing. This pins that a canonically-indented file is
// a fixed point of `format/indent`, including a two-deep block nest.
//
//  1. Parse a function holding an if-block, all at canonical indent.
//  2. Run the rule.
//  3. Assert it emits no finding.
func TestFormatIndentIdempotentOnCorrectNestedBlock(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "function f() {\n  if (x) {\n    return 1;\n  }\n}\n",
  )
}
