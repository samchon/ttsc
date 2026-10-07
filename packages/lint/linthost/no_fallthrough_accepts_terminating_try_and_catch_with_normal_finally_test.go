package linthost

import "testing"

// TestNoFallthroughAcceptsTerminatingTryAndCatchWithNormalFinally verifies try/catch/finally composes all three blocks.
//
// The try can throw before returning, the catch rethrows, and the finally
// logs: its normal completion preserves the original abrupt completion,
// and an exception from logging also cannot reach the case end. No try/catch
// path completes normally. This pins the three-block join of tryCompletion.
//
//  1. End a case with a throwable call before `return`, a rethrowing catch, and
//     an ordinary logging finally.
//  2. Run the engine with no-fallthrough enabled.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for returning try, rethrowing catch and an ordinary logging finalizer.
// @evidence contracts/testing.md#independent-expectations Every authored try/catch path closes; normal finalizer completion preserves those abrupt paths, while a finalizer exception cannot create normal case completion.
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
