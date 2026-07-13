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
