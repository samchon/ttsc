package linthost

import "testing"

// TestFunctionalNoReturnVoidIgnoreInferredTypesStopsAtTheNearestFunction verifies ignoreInferredTypes reads the nearest function-like, including one that cannot declare a return type.
//
// A constructor declares no return type and cannot, so a bare `return;` inside
// one is always inferred. Walking past it to the enclosing function attributed
// that function's annotation to the constructor's statement and reported it, the
// exact misattribution this case pins.
//
// 1. Parse an annotated function containing a class whose constructor ends in a bare `return;`.
// 2. Enable only functional/no-return-void with `ignoreInferredTypes: true`.
// 3. Assert the constructor's bare return is skipped.
func TestFunctionalNoReturnVoidIgnoreInferredTypesStopsAtTheNearestFunction(t *testing.T) {
  const ruleName = "functional/no-return-void"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "function outer(): number {\n  class Inner {\n    constructor() {\n      return;\n    }\n  }\n  return 1;\n}",
    "{\"ignoreInferredTypes\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
