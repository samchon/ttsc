package linthost

import "testing"

// TestNoFallthroughCommandPreservesCatchBreakContinue verifies reachable
// catches propagate break and continue completions, while unreachable catches
// contribute neither. Ordinary finally blocks must preserve those abrupt paths.
//
// 1. Put bare returns and explicit throws before catch break/continue bodies.
// 2. Carry reachable catch escapes through normal finalizers.
// 3. Assert only a reachable, normally completing catch falls through.
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
