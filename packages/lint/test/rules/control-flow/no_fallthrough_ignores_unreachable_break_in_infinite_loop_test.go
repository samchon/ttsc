package linthost

import "testing"

// TestNoFallthroughIgnoresUnreachableBreakInInfiniteLoop verifies an unreachable break cannot reopen an infinite loop's exit.
//
// The `break` after `return` never executes, so the `while (true)` still
// makes the case end unreachable. If unreachable escapes were collected the
// loop would look exitable and a false positive would appear. Locks the
// escapes-only-from-reachable-statements rule of statementListCompletion.
//
// 1. Put `return; break;` inside an infinite loop ending the case.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughIgnoresUnreachableBreakInInfiniteLoop(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
function f(): void {
  switch (foo) {
    case 0:
      while (true) {
        return;
        break;
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "")
}
