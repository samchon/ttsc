package linthost

import "testing"

// TestFormatArrowParensKeepsTypedParamUnderAvoid verifies prefer:"avoid"
// leaves a type-annotated parameter parenthesized — a bare `x: T =>` is not
// valid syntax, so the parens are mandatory (matching Prettier).
//
//  1. Parse `(x: number) => x`.
//  2. Run format/arrow-parens with prefer:"avoid".
//  3. Assert the rule reports nothing.
func TestFormatArrowParensKeepsTypedParamUnderAvoid(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/arrow-parens",
    "const c = (x: number) => x;\n",
    `{"prefer":"avoid"}`,
  )
}
