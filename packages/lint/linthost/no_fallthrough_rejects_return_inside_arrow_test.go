package linthost

import "testing"

// TestNoFallthroughRejectsReturnInsideArrow verifies a nested arrow's return does not terminate the case.
//
// Same function-boundary rule as the function-expression twin, but through an
// arrow with a block body passed to the authored run call. The case
// retains a normal path after that call; the callback return does not exit it.
//
// 1. End a case by passing an arrow whose body returns to run.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight after passing an arrow callback.
// @evidence contracts/testing.md#independent-expectations The authored return belongs to the nested arrow, so defining/passing that callback does not terminate the enclosing case.
// @evidence contracts/testing.md#distinguishing-cases Function-expression and function-declaration rejection twins retain the two other nested execution boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsReturnInsideArrow is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsReturnInsideArrow(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare function run(callback: () => void): void;
switch (foo) {
  case 0:
    run(() => {
      return;
    });
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
