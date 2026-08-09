package linthost

import "testing"

// TestFunctionalNoReturnVoidAllowUndefinedFalseRejectsUndefinedReturnType verifies functional/no-return-void honors allowUndefined: false.
//
// The `undefined` twin of `allowNull`. The two keys select different declared
// return types, so one implementation covering both would let a project
// silence the wrong one.
//
// 1. Parse a function whose declared return type is `undefined`.
// 2. Enable only functional/no-return-void with `allowUndefined: false`.
// 3. Assert the declaration reports.
func TestFunctionalNoReturnVoidAllowUndefinedFalseRejectsUndefinedReturnType(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run(): undefined { return undefined; }",
    "{\"allowUndefined\":false}",
  )
  assertFunctionalFinding(t, ruleName, findings, "return")
}
