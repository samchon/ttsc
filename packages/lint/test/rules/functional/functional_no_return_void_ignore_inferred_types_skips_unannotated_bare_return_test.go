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
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies unannotated bare return is accepted when inferred types are ignored; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The option exempts inferred void-ness, not explicit annotations. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreInferredTypesKeepsAnnotatedBareReturn owns the rejected declared case. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidIgnoreInferredTypesSkipsUnannotatedBareReturn is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
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
