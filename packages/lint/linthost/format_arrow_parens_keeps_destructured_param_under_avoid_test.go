package linthost

import "testing"

// TestFormatArrowParensKeepsDestructuredParamUnderAvoid verifies prefer:
// "avoid" leaves a destructuring parameter parenthesized (`({ x }) =>`),
// matching Prettier — only a plain identifier ever drops its parens.
//
//  1. Parse `({ x }) => x`.
//  2. Run format/arrow-parens with prefer:"avoid".
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must retain the object binding parameter wrapper under avoid instead of turning it into a block or invalid arrow syntax.
// @evidence contracts/testing.md#independent-expectations The literal object binding pattern requires parameter-list parentheses; it cannot be replaced by a bare identifier, independently of the eligibility helper.
// @evidence contracts/testing.md#distinguishing-cases The destructured singleton negative complements plain-identifier stripping and the comma-bearing destructuring guard.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensKeepsDestructuredParamUnderAvoid is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and observes zero findings without applying any edit; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensKeepsDestructuredParamUnderAvoid(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/arrow-parens",
    "const d = ({ x }) => x;\n",
    `{"prefer":"avoid"}`,
  )
}
