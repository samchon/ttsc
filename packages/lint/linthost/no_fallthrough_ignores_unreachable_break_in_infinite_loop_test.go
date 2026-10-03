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
//
// @evidence contracts/testing.md#behavioral-verification No finding reports when a break follows an unconditional return in an infinite loop.
// @evidence contracts/testing.md#independent-expectations The authored statement order makes the break unreachable; an infinite literal-true loop cannot gain an exit from dead syntax.
// @evidence contracts/testing.md#distinguishing-cases RejectsInfiniteWhileContainingBreak retains the reachable-break counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughIgnoresUnreachableBreakInInfiniteLoop is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
