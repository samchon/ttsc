package linthost

import "testing"

// TestNoFallthroughAcceptsTerminatingTryAndCatchWithNormalFinally verifies try/catch/finally composes all three blocks.
//
// The try can throw before returning, the catch rethrows, and the finally
// merely logs: the finally completes normally (so it does not rescue anything)
// while no main-path block completes normally, leaving the case end
// unreachable. Locks the three-block join of tryCompletion in one scenario.
//
//  1. End a case with a throwable call before `return`, a rethrowing catch, and
//     a normally completing finally.
//  2. Run the engine with no-fallthrough enabled.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for returning try, rethrowing catch and normally completing finally.
// @evidence contracts/testing.md#independent-expectations Every authored try/catch path closes and the ordinary finalizer preserves each abrupt completion.
// @evidence contracts/testing.md#distinguishing-cases RejectsNormallyCompletingCatch and RejectsOpenTryWithNormalFinally retain the two ordinary-completion boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsTerminatingTryAndCatchWithNormalFinally is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsTerminatingTryAndCatchWithNormalFinally(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare function maybeThrow(): void;
function f(): void {
  switch (foo) {
    case 0:
      try {
        maybeThrow();
        return;
      } catch {
        throw new Error("rethrow");
      } finally {
        console.log("cleanup");
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "")
}
