package linthost

import "testing"

// TestNoFallthroughAcceptsTerminatingFinally verifies a finally block that breaks terminates the case.
//
// Upstream valid case `try {} finally { break; }`: the finally block runs on
// every path, so its abrupt completion makes the case end unreachable no
// matter what the try block does. Locks the finally-completion-wins rule of
// tryCompletion.
//
// 1. End a case with a try whose finally block breaks.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsTerminatingFinally(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    try {
      console.log(0);
    } finally {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
