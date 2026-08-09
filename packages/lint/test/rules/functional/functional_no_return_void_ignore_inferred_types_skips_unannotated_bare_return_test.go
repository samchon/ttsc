package linthost

import "testing"

// TestFunctionalNoReturnVoidIgnoreInferredTypesSkipsUnannotatedBareReturn verifies functional/no-return-void honors ignoreInferredTypes.
//
// A bare `return;` in a function with no return annotation is the one place
// the rule rejects a void-ness it inferred instead of reading. That is exactly
// what the published option offers to skip, and it decoded nothing before
// #1132.
//
// 1. Parse a function with no return annotation and a bare `return;`.
// 2. Enable only functional/no-return-void with `ignoreInferredTypes: true`.
// 3. Assert the bare return is skipped.
func TestFunctionalNoReturnVoidIgnoreInferredTypesSkipsUnannotatedBareReturn(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run() { return; }",
    "{\"ignoreInferredTypes\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
