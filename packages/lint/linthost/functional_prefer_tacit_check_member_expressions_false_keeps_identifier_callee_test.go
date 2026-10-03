package linthost

import "testing"

// TestFunctionalPreferTacitCheckMemberExpressionsFalseKeepsIdentifierCallee verifies checkMemberExpressions: false leaves a bare callee checked.
//
// The reporting twin. The key narrows the callee shape, not the rule, so a
// wrapper around a plain identifier must still report while the key is off.
//
// 1. Parse an arrow that forwards its parameter to a bare identifier call.
// 2. Enable only functional/prefer-tacit with `checkMemberExpressions: false`.
// 3. Assert the wrapper still reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies identifier forwarding wrapper still reports with member checking disabled; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations A member-only switch cannot exempt bare identifier callees. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases CheckMemberExpressionsFalseSkipsMemberCallee owns the accepted receiver shape.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferTacitCheckMemberExpressionsFalseKeepsIdentifierCallee is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
