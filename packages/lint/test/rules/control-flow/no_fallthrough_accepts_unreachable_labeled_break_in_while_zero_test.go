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
