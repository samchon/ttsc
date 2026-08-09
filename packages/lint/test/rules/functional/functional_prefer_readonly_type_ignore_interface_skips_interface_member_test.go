package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreInterfaceSkipsInterfaceMember verifies functional/prefer-readonly-type honors ignoreInterface.
//
// `ignoreInterface` is published as a whole-interface skip and decoded nothing
// before #1132. The gate is an ancestor test, so it has to hold for a member
// nested inside the interface rather than for the interface node itself.
//
// 1. Parse an interface with a non-readonly string property.
// 2. Enable only functional/prefer-readonly-type with `ignoreInterface: true`.
// 3. Assert the member is skipped.
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
