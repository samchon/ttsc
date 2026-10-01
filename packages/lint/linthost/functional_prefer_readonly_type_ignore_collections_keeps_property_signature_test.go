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
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies a mutable scalar property still reports when collections are ignored; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations A string property is not an array, tuple or collection reference. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreCollectionsSkipsArrayType owns the accepted collection shape.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoreCollectionsKeepsPropertySignature is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
