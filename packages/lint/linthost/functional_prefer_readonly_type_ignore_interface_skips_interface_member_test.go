package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreInterfaceSkipsInterfaceMember verifies functional/prefer-readonly-type honors ignoreInterface.
//
// The published interface exemption follows the member's actual ancestor.
// This fixture observes a non-readonly property inside an interface,
// rather than a report on the interface node itself.
//
// 1. Parse an interface with a non-readonly string property.
// 2. Enable only functional/prefer-readonly-type with `ignoreInterface: true`.
// 3. Assert the member is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable interface member stays accepted with ignoreInterface true; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The exemption follows the interface ancestor through its member. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreInterfaceKeepsTypeAliasMember owns the unaffected alias member.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoreInterfaceSkipsInterfaceMember is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeIgnoreInterfaceSkipsInterfaceMember(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "interface Shape { value: string; }",
    "{\"ignoreInterface\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
