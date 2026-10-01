package linthost

import "testing"

// TestNoFallthroughAcceptsBreakInTryWithNormalFinally verifies a break inside try propagates through a normally-completing finally.
//
// Upstream valid case `try { break; } finally {}`: the finally block completes
// normally, so the try block's abrupt completion survives and the case cannot
// reach its end. Locks the escape-propagation half of tryCompletion.
//
// 1. End a case with `try { break; } finally { console.log(...) }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when the try breaks and the ordinary finally only logs.
// @evidence contracts/testing.md#independent-expectations A normally completing finalizer preserves the original break rather than replacing it with normal completion.
// @evidence contracts/testing.md#distinguishing-cases RejectsOpenTryWithNormalFinally supplies the open-try twin under the same ordinary finalizer.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsBreakInTryWithNormalFinally is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsBreakInTryWithNormalFinally(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    try {
      break;
    } finally {
      console.log("cleanup");
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
