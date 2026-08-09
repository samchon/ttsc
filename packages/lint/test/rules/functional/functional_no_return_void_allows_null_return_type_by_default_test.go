package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowsNullReturnTypeByDefault verifies a declared null return type is accepted with no options.
//
// The negative twin of `allowNull: false`. Honoring the option must not turn
// `null` into a rejected return type for every project that never set it,
// which is the regression an option added on the reporting side would cause.
//
// 1. Parse a function whose declared return type is `null`.
// 2. Enable only functional/no-return-void with no options.
// 3. Assert nothing reports.
func TestFunctionalNoReturnVoidAllowsNullReturnTypeByDefault(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRule(t, ruleName, "function run(): null { return null; }")
  assertNoFunctionalFinding(t, ruleName, findings)
}
