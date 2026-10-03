package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreCollectionsSkipsArrayType verifies functional/prefer-readonly-type honors ignoreCollections.
//
// This array alias belongs to the published collection exemption. The
// configured zero-finding comparison observes that array shape; tuples
// and collection references are not present in this fixture.
//
// 1. Parse a mutable array type alias.
// 2. Enable only functional/prefer-readonly-type with `ignoreCollections: true`.
// 3. Assert the array type is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable array alias stays accepted when collections are ignored; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations Array annotations belong to the published collection exemption. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreCollectionsKeepsPropertySignature owns the non-collection position.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoreCollectionsSkipsArrayType is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
