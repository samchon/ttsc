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
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies bare return in a number-annotated function reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations An explicit return annotation is not inferred and remains checked. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreInferredTypesSkipsUnannotatedBareReturn owns the accepted inference-only case. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidIgnoreInferredTypesKeepsAnnotatedBareReturn is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
