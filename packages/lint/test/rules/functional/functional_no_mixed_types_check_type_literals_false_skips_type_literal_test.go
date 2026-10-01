package linthost

import "testing"

// TestFunctionalNoMixedTypesCheckTypeLiteralsFalseSkipsTypeLiteral verifies functional/no-mixed-types honors checkTypeLiterals: false.
//
// The type-literal arm of the same gate. Both container kinds ship their own
// key, so both need their own witness or one can silently take the other's
// branch.
//
// 1. Parse a type literal that mixes a property and a method.
// 2. Enable only functional/no-mixed-types with `checkTypeLiterals: false`.
// 3. Assert the type literal is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mixed type literal is accepted with checkTypeLiterals false; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The option disables type literals, not interfaces. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases CheckTypeLiteralsFalseStillChecksInterface owns the adjacent unaffected container.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoMixedTypesCheckTypeLiteralsFalseSkipsTypeLiteral is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoMixedTypesCheckTypeLiteralsFalseSkipsTypeLiteral(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Mixed = { value: string; run(): void };",
    "{\"checkTypeLiterals\":false}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
