package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowsNullReturnTypeByDefault verifies a declared null return type is accepted with no options.
//
// The negative twin of `allowNull: false`. Honoring the option must not turn
// `null` into a rejected return type for every project that never set it,
// which is the regression an option added on the reporting side would cause.
//
// 1. Parse a function whose declared return type is `null`.
// 2. Enable only functional/no-return-void with no options.
// 3. Assert nothing reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies declared null return is accepted by default; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations allowNull defaults to true. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases AllowNullFalseRejectsNullReturnType owns the explicit-false rejection.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidAllowsNullReturnTypeByDefault is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoReturnVoidAllowsNullReturnTypeByDefault(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRule(t, ruleName, "function run(): null { return null; }")
  assertNoFunctionalFinding(t, ruleName, findings)
}
