package linthost

import "testing"

// TestFormatArrowParensKeepsTypedParamUnderAvoid verifies prefer:"avoid"
// leaves a type-annotated parameter parenthesized — a bare `x: T =>` is not
// valid syntax, so the parens are mandatory (matching Prettier).
//
//  1. Parse `(x: number) => x`.
//  2. Run format/arrow-parens with prefer:"avoid".
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must offer no finding for the number-annotated singleton under avoid, retaining its syntactically required parameter parentheses.
// @evidence contracts/testing.md#independent-expectations The literal x:number annotation requires a parenthesized parameter list by TypeScript arrow grammar; absence of an edit is specified independently from the rule.
// @evidence contracts/testing.md#distinguishing-cases This annotated negative contrasts with eligible plain x stripping; the trailing-comma matrix separately owns the same mandatory-parentheses condition with a comma.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensKeepsTypedParamUnderAvoid is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and observes zero findings without applying any edit; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensKeepsTypedParamUnderAvoid(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/arrow-parens",
    "const c = (x: number) => x;\n",
    `{"prefer":"avoid"}`,
  )
}
