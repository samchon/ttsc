package linthost

import "testing"

// TestFunctionalPreferTacitCheckMemberExpressionsFalseSkipsMemberCallee verifies functional/prefer-tacit honors checkMemberExpressions: false.
//
// A member callee is the wrapper whose tacit form loses its receiver, so the
// published key exists to keep the rule off it. It decoded nothing before
// #1132.
//
// 1. Parse an arrow that forwards its parameter to a member call.
// 2. Enable only functional/prefer-tacit with `checkMemberExpressions: false`.
// 3. Assert the wrapper is skipped.
func TestFunctionalPreferTacitCheckMemberExpressionsFalseSkipsMemberCallee(t *testing.T) {
  const ruleName = "functional/prefer-tacit"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "const wrap = (value: string) => service.handler(value);",
    "{\"checkMemberExpressions\":false}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
