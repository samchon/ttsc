package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreCollectionsKeepsPropertySignature verifies ignoreCollections leaves non-collection positions checked.
//
// The negative twin. The key names a set of type shapes, so a mutable property
// signature whose type is not a collection must still require its readonly
// modifier.
//
// 1. Parse a type literal with a non-readonly string property.
// 2. Enable only functional/prefer-readonly-type with `ignoreCollections: true`.
// 3. Assert the property signature still reports.
func TestFunctionalPreferReadonlyTypeIgnoreCollectionsKeepsPropertySignature(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Shape = { value: string };",
    "{\"ignoreCollections\":true}",
  )
  assertFunctionalFinding(t, ruleName, findings, "readonly")
}
