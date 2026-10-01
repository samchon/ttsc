package linthost

import "testing"

// TestFunctionalNoMixedTypesCheckInterfacesFalseSkipsInterface verifies functional/no-mixed-types honors checkInterfaces: false.
//
// `checkInterfaces` was published, documented as a working gate, and never
// decoded, so a project that turned interfaces off still got the diagnostic
// (#1132). This pins the interface arm of the gate.
//
// 1. Parse an interface that mixes a property and a method.
// 2. Enable only functional/no-mixed-types with `checkInterfaces: false`.
// 3. Assert the interface is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mixed interface is accepted with checkInterfaces false; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The option disables interface containers, not type literals. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases CheckInterfacesFalseStillChecksTypeLiteral owns the adjacent unaffected container.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoMixedTypesCheckInterfacesFalseSkipsInterface is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoMixedTypesCheckInterfacesFalseSkipsInterface(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "interface Mixed { value: string; run(): void; }",
    "{\"checkInterfaces\":false}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
