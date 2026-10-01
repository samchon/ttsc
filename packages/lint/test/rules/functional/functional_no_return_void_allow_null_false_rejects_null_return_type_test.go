package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowNullFalseRejectsNullReturnType verifies functional/no-return-void honors allowNull: false.
//
// `allowNull` defaults to true, so its only observable effect is the explicit
// false: a declared `null` return type joins `void` in being rejected. The
// field was published and never decoded before #1132.
//
// 1. Parse a function whose declared return type is `null`.
// 2. Enable only functional/no-return-void with `allowNull: false`.
// 3. Assert the declaration reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies declared null return reports with allowNull false; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The explicit option adds null to rejected return kinds. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases AllowsNullReturnTypeByDefault owns the accepted default.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidAllowNullFalseRejectsNullReturnType is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoReturnVoidAllowNullFalseRejectsNullReturnType(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run(): null { return null; }",
    "{\"allowNull\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "return")
}
