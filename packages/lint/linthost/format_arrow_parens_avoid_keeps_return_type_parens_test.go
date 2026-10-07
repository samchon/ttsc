package linthost

import "testing"

// Test_format_arrow_parens_avoid_keeps_return_type_parens verifies the rule
// keeps the parameter parentheses when the arrow function declares an
// explicit return type, because the return annotation requires a parenthesized parameter list.
//
//  1. Provide an arrow function whose single parameter is wrapped in
//     parentheses and that carries an explicit return type.
//  2. Run the format/arrow-parens rule in "avoid" mode.
//  3. Expect the rule to skip the source, since "x: number => x"
//     is not a legal unparenthesized typed-arrow parameter signature.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must decline removal of parameter parentheses from an arrow with an explicit number return type.
// @evidence contracts/testing.md#independent-expectations TypeScript return-type grammar associates the colon after the closing parameter list with the return type; dropping the list parentheses does not form a legal typed-arrow signature.
// @evidence contracts/testing.md#distinguishing-cases The return-annotation negative complements the otherwise eligible plain singleton positive and separately typed-parameter negative.
// @evidence contracts/testing.md#execution-ownership Test_format_arrow_parens_avoid_keeps_return_type_parens is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and observes zero findings without applying any edit; this host owns every named case without a consumer install, native product build or product host.
func Test_format_arrow_parens_avoid_keeps_return_type_parens(t *testing.T) {
  const ruleID = "format/arrow-parens"
  const source = "const f = (x): number => x;\n"
  const optionsJSON = "{\"prefer\":\"avoid\"}"
  assertRuleSkipsSourceWithOptions(t, ruleID, source, optionsJSON)
}
