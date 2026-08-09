package linthost

import "testing"

// TestFunctionalNoMixedTypesCheckInterfacesFalseStillChecksTypeLiteral verifies checkInterfaces: false leaves type literals checked.
//
// The negative twin of the interface gate. A gate implemented as an early
// return before the container switch would silence both kinds at once, and
// nothing else in the corpus would notice.
//
// 1. Parse a type literal that mixes a property and a method.
// 2. Enable only functional/no-mixed-types with `checkInterfaces: false`.
// 3. Assert the type literal still reports.
func TestFunctionalNoMixedTypesCheckInterfacesFalseStillChecksTypeLiteral(t *testing.T) {
  const ruleName = "functional/no-mixed-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Mixed = { value: string; run(): void };",
    "{\"checkInterfaces\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "same kind")
}
