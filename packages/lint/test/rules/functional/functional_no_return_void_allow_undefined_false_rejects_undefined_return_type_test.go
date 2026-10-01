package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowUndefinedFalseRejectsUndefinedReturnType verifies functional/no-return-void honors allowUndefined: false.
//
// The `undefined` twin of `allowNull`. The two keys select different declared
// return types, so one implementation covering both would let a project
// silence the wrong one.
//
// 1. Parse a function whose declared return type is `undefined`.
// 2. Enable only functional/no-return-void with `allowUndefined: false`.
// 3. Assert the declaration reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies declared undefined return reports with allowUndefined false; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The explicit option adds undefined to rejected return kinds. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases AllowsUndefinedReturnTypeByDefault owns the accepted default.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidAllowUndefinedFalseRejectsUndefinedReturnType is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoReturnVoidAllowUndefinedFalseRejectsUndefinedReturnType(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run(): undefined { return undefined; }",
    "{\"allowUndefined\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "return")
}
