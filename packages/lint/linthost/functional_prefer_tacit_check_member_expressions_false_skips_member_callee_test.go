package linthost

import "testing"

// TestFunctionalPreferTacitCheckMemberExpressionsFalseSkipsMemberCallee verifies functional/prefer-tacit honors checkMemberExpressions: false.
//
// Removing a member-call wrapper can lose its receiver binding. The
// published switch exempts this service.handler wrapper while leaving
// the separately owned bare-identifier wrapper checked.
//
// 1. Parse an arrow that forwards its parameter to a member call.
// 2. Enable only functional/prefer-tacit with `checkMemberExpressions: false`.
// 3. Assert the wrapper is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies service.handler forwarding wrapper stays accepted when members are excluded; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations Removing a receiver-preserving wrapper can lose this binding, so this option exempts member callees. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases CheckMemberExpressionsFalseKeepsIdentifierCallee owns the unaffected identifier call.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferTacitCheckMemberExpressionsFalseSkipsMemberCallee is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
