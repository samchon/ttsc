package linthost

import "testing"

// TestFunctionalNoReturnVoidIgnoreInferredTypesReadsAGetAccessorAnnotation
// verifies a get accessor's declared return type counts as declared.
//
// A get accessor is the one function-like that both stops the enclosing walk and
// may annotate its return type. Reading annotations from a four-kind table while
// walking over every kind made the accessor look annotation-less, so
// `ignoreInferredTypes` spared a bare `return;` the rule reports in the
// identical function-declaration shape.
//
// 1. Parse a get accessor that declares a return type and ends in a bare `return;`.
// 2. Enable only functional/no-return-void with `ignoreInferredTypes: true`.
// 3. Assert the bare return still reports.
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
