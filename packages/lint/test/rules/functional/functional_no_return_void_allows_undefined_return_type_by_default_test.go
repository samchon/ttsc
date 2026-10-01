package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowsUndefinedReturnTypeByDefault verifies a declared undefined return type is accepted with no options.
//
// The default twin of `allowUndefined: false`, matching the one `allowNull`
// already carries. Honoring the option must not turn `undefined` into a rejected
// return type for every project that never set it.
//
// 1. Parse a function whose declared return type is `undefined`.
// 2. Enable only functional/no-return-void with no options.
// 3. Assert nothing reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies declared undefined return is accepted by default; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations allowUndefined defaults to true. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases AllowUndefinedFalseRejectsUndefinedReturnType owns the explicit-false rejection.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidAllowsUndefinedReturnTypeByDefault is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoReturnVoidAllowsUndefinedReturnTypeByDefault(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRule(t, ruleName, "function run(): undefined { return undefined; }")
  assertNoFunctionalFinding(t, ruleName, findings)
}
