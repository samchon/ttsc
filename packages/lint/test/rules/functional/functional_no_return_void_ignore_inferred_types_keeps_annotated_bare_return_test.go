package linthost

import "testing"

// TestFunctionalNoReturnVoidIgnoreInferredTypesKeepsAnnotatedBareReturn verifies ignoreInferredTypes spares only the unannotated bare return.
//
// The negative twin. A gate that skipped every bare `return;` would read as
// working against the positive case while quietly disabling the whole return
// statement branch, which the annotation is what distinguishes.
//
// 1. Parse a function that declares a return type and still ends in a bare `return;`.
// 2. Enable only functional/no-return-void with `ignoreInferredTypes: true`.
// 3. Assert the bare return still reports.
func TestFunctionalNoReturnVoidIgnoreInferredTypesKeepsAnnotatedBareReturn(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function run(): number { return; }",
    "{\"ignoreInferredTypes\":true}",
  )
  assertFunctionalFinding(t, ruleName, findings, "return")
}
