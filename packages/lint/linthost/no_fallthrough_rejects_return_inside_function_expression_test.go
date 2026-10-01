package linthost

import "testing"

// TestNoFallthroughRejectsReturnInsideFunctionExpression verifies a nested function expression's return does not terminate the case.
//
// The `return` belongs to the callback, not to the case: after defining and
// calling it, control still reaches the case end. Locks the function-boundary
// rule: expression evaluation is inspected for abrupt edges, but nested
// function bodies stay invisible.
//
// 1. End a case with a function expression containing `return` plus a call.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight after a function-expression callback.
// @evidence contracts/testing.md#independent-expectations The authored return exits the callback instead of the switch case, making its next label reachable under the supported policy.
// @evidence contracts/testing.md#distinguishing-cases Arrow and declaration rejection twins retain both neighboring function forms.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsReturnInsideFunctionExpression is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsReturnInsideFunctionExpression(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    const f = function (): void {
      return;
    };
    f();
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
