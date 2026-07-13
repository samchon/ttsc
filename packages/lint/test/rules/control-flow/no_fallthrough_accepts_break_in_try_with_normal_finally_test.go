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
