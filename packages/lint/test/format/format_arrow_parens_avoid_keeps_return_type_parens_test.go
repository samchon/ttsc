package linthost

import "testing"

// Test_format_arrow_parens_avoid_keeps_return_type_parens verifies the rule
// keeps the parameter parentheses when the arrow function declares an
// explicit return type, because dropping them would reparse the program.
//
//  1. Provide an arrow function whose single parameter is wrapped in
//     parentheses and that carries an explicit return type.
//  2. Run the format/arrow-parens rule in "avoid" mode.
//  3. Expect the rule to skip the source, since "x: number => x" would
//     attach the type annotation to the parameter instead.
func Test_format_arrow_parens_avoid_keeps_return_type_parens(t *testing.T) {
  const ruleID = "format/arrow-parens"
  const source = "const f = (x): number => x;\n"
  const optionsJSON = "{\"prefer\":\"avoid\"}"
  assertRuleSkipsSourceWithOptions(t, ruleID, source, optionsJSON)
}
