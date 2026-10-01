package linthost

import "testing"

// TestNoFallthroughCommandPreservesCatchBreakContinue verifies reachable
// catches propagate break and continue completions, while unreachable catches
// contribute neither. Ordinary finally blocks must preserve those abrupt paths.
//
// 1. Put bare returns and explicit throws before catch break/continue bodies.
// 2. Carry reachable catch escapes through normal finalizers.
// 3. Assert only a reachable, normally completing catch falls through.
//
// @evidence contracts/testing.md#behavioral-verification The in-process check reports only the authored reachable, normally completing catch transition.
// @evidence contracts/testing.md#independent-expectations Bare return creates no first-throwable edge under the supported CodePath policy; explicit throw reaches catch, whose loop/switch escape remains abrupt through an ordinary finalizer.
// @evidence contracts/testing.md#distinguishing-cases Original return/throw and break/continue pairs stay clean while the empty reachable catch reports.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughCommandPreservesCatchBreakContinue is selected in the shared Go unit population and invokes assertNoFallthroughCommandMarkers and run(check) with the actual Program. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughCommandPreservesCatchBreakContinue(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `function inspect(value: number): unknown {
  outer: for (;;) {
    switch (value) {
      case 0:
        try {
          return;
        } catch {
          continue outer;
        }
      case 1:
        break outer;
      case 2:
        try {
          throw 0;
        } catch {
          continue outer;
        } finally {}
      case 3:
        break outer;
      case 4:
        try {
          return;
        } catch {
          break;
        }
      case 5:
        break outer;
      case 6:
        try {
          throw 0;
        } catch {
          break;
        } finally {}
      case 7:
        break outer;
      case 8:
        try {
          throw 0;
        } catch {}
      case 9: // diagnostic
        break outer;
    }
    break;
  }
}

inspect(0);
`)
}
