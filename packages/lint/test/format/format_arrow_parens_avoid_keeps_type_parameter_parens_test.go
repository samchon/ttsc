package linthost

import "testing"

// Test_format_arrow_parens_avoid_keeps_type_parameter_parens verifies the
// rule keeps the parameter parentheses when the arrow function declares
// type parameters, because dropping them would be invalid syntax.
//
//  1. Provide an arrow function with a type parameter and a single
//     identifier parameter wrapped in parentheses.
//  2. Run the format/arrow-parens rule in "avoid" mode.
//  3. Expect the rule to skip the source, since "<T>x => x" cannot parse.
func Test_format_arrow_parens_avoid_keeps_type_parameter_parens(t *testing.T) {
  const ruleID = "format/arrow-parens"
  const source = "const f = <T>(x) => x;\n"
  const optionsJSON = "{\"prefer\":\"avoid\"}"
  assertRuleSkipsSourceWithOptions(t, ruleID, source, optionsJSON)
}
