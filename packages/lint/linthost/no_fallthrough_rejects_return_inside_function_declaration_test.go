package linthost

import "testing"

// TestNoFallthroughRejectsReturnInsideFunctionDeclaration verifies a nested function declaration's return does not terminate the case.
//
// A function declaration IS a statement in the case body, so this pins the
// statement-level boundary: the declaration completes normally without its
// body being analyzed. Complements the expression-level twins (function
// expression, arrow).
//
// 1. End a case with a function declaration whose body returns, plus a call.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line eight after a nested function declaration and call.
// @evidence contracts/testing.md#independent-expectations The declaration's return belongs to the nested function and the following invocation completes back into the enclosing case.
// @evidence contracts/testing.md#distinguishing-cases Arrow and function-expression rejection twins preserve expression-level function boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsReturnInsideFunctionDeclaration is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsReturnInsideFunctionDeclaration(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    function helper(): void {
      return;
    }
    helper();
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
