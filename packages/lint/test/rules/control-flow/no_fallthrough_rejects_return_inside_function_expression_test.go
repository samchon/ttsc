package linthost

import "testing"

// TestNoFallthroughRejectsReturnInsideFunctionExpression verifies a nested function expression's return does not terminate the case.
//
// The `return` belongs to the callback, not to the case: after defining and
// calling it, control still reaches the case end. Locks the
// function-boundary rule — the completion analysis never descends into
// expression trees, so nested function bodies stay invisible.
//
// 1. End a case with a function expression containing `return` plus a call.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
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
