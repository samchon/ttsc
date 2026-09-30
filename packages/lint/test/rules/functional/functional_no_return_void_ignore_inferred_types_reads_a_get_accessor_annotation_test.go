package linthost

import "testing"

// TestFunctionalNoReturnVoidIgnoreInferredTypesReadsAGetAccessorAnnotation
// verifies a get accessor's declared return type counts as declared.
//
// A get accessor is the one function-like outside the annotation table that both
// stops the enclosing walk and may annotate its return type. Reading annotations from a four-kind table while
// walking over every kind made the accessor look annotation-less, so
// `ignoreInferredTypes` spared a bare `return;` the rule reports in the
// identical function-declaration shape.
//
// 1. Parse a get accessor that declares a return type and ends in a bare `return;`.
// 2. Enable only functional/no-return-void with `ignoreInferredTypes: true`.
// 3. Assert the bare return still reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies bare return in a number-annotated get accessor reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations A get accessor is function-like and its own explicit annotation must count. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The constructor-nearest test owns a function-like that cannot declare a return type. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoReturnVoidIgnoreInferredTypesReadsAGetAccessorAnnotation is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoReturnVoidIgnoreInferredTypesReadsAGetAccessorAnnotation(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "class Store {\n  get value(): number {\n    return;\n  }\n}",
    `{"ignoreInferredTypes":true}`,
  )
  assertFunctionalFinding(t, ruleName, findings, "return")
}
