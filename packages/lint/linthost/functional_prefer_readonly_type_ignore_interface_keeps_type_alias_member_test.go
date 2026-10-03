package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreInterfaceKeepsTypeAliasMember verifies ignoreInterface leaves type-alias members checked.
//
// The reporting alias twin has the same property shape as the accepted
// interface fixture. An exemption that matched every declaration instead
// of an interface ancestor would incorrectly silence this alias member.
//
// 1. Parse a type alias with a non-readonly string property.
// 2. Enable only functional/prefer-readonly-type with `ignoreInterface: true`.
// 3. Assert the member still reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable type-alias member still reports with ignoreInterface true; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations A structurally similar type alias is not an interface ancestor. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreInterfaceSkipsInterfaceMember owns the accepted interface.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoreInterfaceKeepsTypeAliasMember is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeIgnoreInterfaceKeepsTypeAliasMember(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Shape = { value: string };",
    "{\"ignoreInterface\":true}",
  )
  assertFunctionalFinding(t, ruleName, findings, "readonly")
}
