package linthost

import "testing"

// TestFormatArrowParensKeepsDestructuredParamUnderAvoid verifies prefer:
// "avoid" leaves a destructuring parameter parenthesized (`({ x }) =>`),
// matching Prettier — only a plain identifier ever drops its parens.
//
//  1. Parse `({ x }) => x`.
//  2. Run format/arrow-parens with prefer:"avoid".
//  3. Assert the rule reports nothing.
func TestFormatArrowParensKeepsDestructuredParamUnderAvoid(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/arrow-parens",
    "const d = ({ x }) => x;\n",
    `{"prefer":"avoid"}`,
  )
}
