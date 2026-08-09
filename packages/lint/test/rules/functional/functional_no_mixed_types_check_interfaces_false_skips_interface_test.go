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
