package linthost

import "testing"

// TestFunctionalNoMixedTypesCheckInterfacesFalseStillChecksTypeLiteral verifies checkInterfaces: false leaves type literals checked.
//
// The negative twin of the interface gate. A gate implemented as an early
// return before the container switch would silence both kinds at once, and
// nothing else in the corpus would notice.
//
// 1. Parse a type literal that mixes a property and a method.
// 2. Enable only functional/no-mixed-types with `checkInterfaces: false`.
// 3. Assert the type literal still reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mixed type literal reports with checkInterfaces false; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The interface-only switch cannot exempt a type literal. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases CheckInterfacesFalseSkipsInterface owns the accepted target container.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoMixedTypesCheckInterfacesFalseStillChecksTypeLiteral is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoMixedTypesCheckInterfacesFalseStillChecksTypeLiteral(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Mixed = { value: string; run(): void };",
    "{\"checkInterfaces\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "same kind")
}
