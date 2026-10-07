package linthost

import "testing"

// TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileZero verifies `while (0)` folds to constant false like ESLint.
//
// ESLint's simple-constant folding covers numeric literals, so `while (0)`
// never runs its body and the dead `break target` inside it must not count.
// Same shape as the `while (false)` twin, exercising the numeric-zero side
// of literalTruthiness instead of the false keyword.
//
// 1. Put a dead `break target` inside `while (0)`, followed by a throw.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when numeric-zero while hides a block-targeted break before a throw.
// @evidence contracts/testing.md#independent-expectations Bare numeric zero follows the supported literal-falsy policy, distinct from a reachable break or a non-literal expression.
// @evidence contracts/testing.md#distinguishing-cases AcceptsUnreachableLabeledBreakInWhileFalse supplies the keyword counterpart and self-targeted block rejection owns reachable escape.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileZero is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileZero(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
function f(): void {
  switch (foo) {
    case 0:
      target: {
        while (0) {
          break target;
        }
        throw new Error("stop");
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "")
}
