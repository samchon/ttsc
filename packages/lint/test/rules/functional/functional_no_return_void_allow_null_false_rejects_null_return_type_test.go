package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowNullFalseRejectsNullReturnType verifies functional/no-return-void honors allowNull: false.
//
// `allowNull` defaults to true, so its only observable effect is the explicit
// false: a declared `null` return type joins `void` in being rejected. The
// field was published and never decoded before #1132.
//
// 1. Parse a function whose declared return type is `null`.
// 2. Enable only functional/no-return-void with `allowNull: false`.
// 3. Assert the declaration reports.
func TestFunctionalNoReturnVoidAllowNullFalseRejectsNullReturnType(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run(): null { return null; }",
    "{\"allowNull\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "return")
}
