package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoresCodePattern verifies functional/prefer-readonly-type.
//
// Array-type diagnostics do not have a useful declaration identifier at the
// reported node. This locks the source-code pattern escape hatch for that path.
//
// 1. Parse a mutable array type alias.
// 2. Enable only functional/prefer-readonly-type with `ignoreCodePattern`.
// 3. Assert the array type is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable array alias is accepted with matching source pattern; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The code-pattern exemption selects the string[] annotation itself. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases PreferReadonlyTypeRejectsArrayType owns the unconfigured rejection.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoresCodePattern is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeIgnoresCodePattern(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    `type Values = string[];`,
    `{"ignoreCodePattern":"string\\[\\]"}`,
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
