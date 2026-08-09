package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeCoversCallSignature verifies allowMutableReturnType covers a call signature's return type.
//
// A return-type position is a return-type position however the signature is
// spelled. The first implementation listed six declaration kinds and left call
// signatures, construct signatures, constructor types, and get accessors
// reporting, so the same option answered differently for the same position.
//
// 1. Parse an interface whose call signature returns a mutable array.
// 2. Enable only functional/prefer-readonly-type with `allowMutableReturnType: true`.
// 3. Assert the return annotation is skipped.
func TestFunctionalPreferReadonlyTypeAllowMutableReturnTypeCoversCallSignature(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "interface Factory {\n  (): string[];\n}",
    "{\"allowMutableReturnType\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
