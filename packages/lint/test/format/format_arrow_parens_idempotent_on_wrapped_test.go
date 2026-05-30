package linthost

import "testing"

// TestFormatArrowParensIdempotentOnWrapped verifies prefer:"always" is a
// no-op on an already-parenthesized single parameter, so the cascade reaches
// a fixed point.
//
//  1. Parse `(x) => x`.
//  2. Run format/arrow-parens with prefer:"always".
//  3. Assert the rule reports nothing.
func TestFormatArrowParensIdempotentOnWrapped(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/arrow-parens",
    "const a = (x) => x;\n",
    `{"prefer":"always"}`,
  )
}
