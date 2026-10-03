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
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must retain parentheses after a generic T parameter declaration even when the ordinary parameter is a plain identifier.
// @evidence contracts/testing.md#independent-expectations TypeScript generic-arrow syntax requires the parameter list after T; the independently supplied literal <T>(x) must not become <T>x.
// @evidence contracts/testing.md#distinguishing-cases This generic-but-untyped-value-parameter negative distinguishes the type-parameter guard from typed-parameter eligibility and plain nongeneric stripping.
// @evidence contracts/testing.md#execution-ownership Test_format_arrow_parens_avoid_keeps_type_parameter_parens is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and observes zero findings without applying any edit; this host owns every named case without a consumer install, native product build or product host.
func Test_format_arrow_parens_avoid_keeps_type_parameter_parens(t *testing.T) {
  const ruleID = "format/arrow-parens"
  const source = "const f = <T>(x) => x;\n"
  const optionsJSON = "{\"prefer\":\"avoid\"}"
  assertRuleSkipsSourceWithOptions(t, ruleID, source, optionsJSON)
}
