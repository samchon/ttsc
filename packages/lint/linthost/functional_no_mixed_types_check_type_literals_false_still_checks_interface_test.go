package linthost

import "testing"

// TestFunctionalNoMixedTypesCheckTypeLiteralsFalseStillChecksInterface verifies checkTypeLiterals: false leaves interfaces checked.
//
// The reporting interface twin checks the type-literal switch's boundary.
// The two keys select different container kinds, so disabling type literals
// must not silence this mixed interface.
//
// 1. Parse an interface that mixes a property and a method.
// 2. Enable only functional/no-mixed-types with `checkTypeLiterals: false`.
// 3. Assert the interface still reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mixed interface reports with checkTypeLiterals false; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The type-literal switch cannot exempt an interface. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases CheckTypeLiteralsFalseSkipsTypeLiteral owns the accepted target container.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoMixedTypesCheckTypeLiteralsFalseStillChecksInterface is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoMixedTypesCheckTypeLiteralsFalseStillChecksInterface(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "interface Mixed { value: string; run(): void; }",
    "{\"checkTypeLiterals\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "same kind")
}
