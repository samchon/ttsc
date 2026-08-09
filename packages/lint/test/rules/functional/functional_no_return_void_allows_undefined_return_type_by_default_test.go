package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowsUndefinedReturnTypeByDefault verifies a declared undefined return type is accepted with no options.
//
// The default twin of `allowUndefined: false`, matching the one `allowNull`
// already carries. Honoring the option must not turn `undefined` into a rejected
// return type for every project that never set it.
//
// 1. Parse a function whose declared return type is `undefined`.
// 2. Enable only functional/no-return-void with no options.
// 3. Assert nothing reports.
func TestFunctionalNoReturnVoidAllowsUndefinedReturnTypeByDefault(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRule(t, ruleName, "function run(): undefined { return undefined; }")
  assertNoFunctionalFinding(t, ruleName, findings)
}
