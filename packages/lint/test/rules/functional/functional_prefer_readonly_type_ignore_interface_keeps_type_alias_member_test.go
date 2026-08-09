package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreInterfaceKeepsTypeAliasMember verifies ignoreInterface leaves type-alias members checked.
//
// The negative twin. An ancestor test that matched any declaration, or that
// ran before the member kind was known, would silence type aliases too, and
// the two spell the same member shape.
//
// 1. Parse a type alias with a non-readonly string property.
// 2. Enable only functional/prefer-readonly-type with `ignoreInterface: true`.
// 3. Assert the member still reports.
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
