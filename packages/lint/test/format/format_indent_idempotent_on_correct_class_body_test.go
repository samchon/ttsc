package linthost

import "testing"

// TestFormatIndentIdempotentOnCorrectClassBody verifies an
// already-correct class method body produces zero edits.
//
// Before the class-body frame was counted, a method-body statement was
// computed at depth 1, so correct four-space class bodies were rewritten
// back to two spaces and the rule fought Prettier on every pass. This
// pins idempotency: a canonical class body is a fixed point.
//
//  1. Parse a class whose method body is already at four spaces.
//  2. Run the rule.
//  3. Assert it emits no finding.
func TestFormatIndentIdempotentOnCorrectClassBody(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "class C {\n  m() {\n    return 1;\n  }\n}\n",
  )
}
