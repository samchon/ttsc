package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreCollectionsSkipsArrayType verifies functional/prefer-readonly-type honors ignoreCollections.
//
// `ignoreCollections` is published as a skip for array, tuple, and mutable
// collection references and decoded nothing before #1132, so a project that
// set it still got every array type reported.
//
// 1. Parse a mutable array type alias.
// 2. Enable only functional/prefer-readonly-type with `ignoreCollections: true`.
// 3. Assert the array type is skipped.
func TestFunctionalPreferReadonlyTypeIgnoreCollectionsSkipsArrayType(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Values = string[];",
    "{\"ignoreCollections\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
