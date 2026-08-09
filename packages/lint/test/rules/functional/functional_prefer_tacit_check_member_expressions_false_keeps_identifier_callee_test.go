package linthost

import "testing"

// TestFunctionalPreferTacitCheckMemberExpressionsFalseKeepsIdentifierCallee verifies checkMemberExpressions: false leaves a bare callee checked.
//
// The negative twin. The key narrows the callee shape, not the rule, so a
// wrapper around a plain identifier must still report while the key is off.
//
// 1. Parse an arrow that forwards its parameter to a bare identifier call.
// 2. Enable only functional/prefer-tacit with `checkMemberExpressions: false`.
// 3. Assert the wrapper still reports.
func TestFunctionalPreferTacitCheckMemberExpressionsFalseKeepsIdentifierCallee(t *testing.T) {
  const ruleName = "functional/prefer-tacit"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "const wrap = (value: string) => handler(value);",
    "{\"checkMemberExpressions\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "wrapper")
}
