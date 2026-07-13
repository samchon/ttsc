package linthost

import "testing"

// TestNoFallthroughAcceptsContinueTerminatingCase verifies a continue targeting an enclosing loop terminates the case.
//
// Upstream valid case `while (a) { switch (foo) { case 0: a(); continue;
// case 1: b(); } }`: the continue leaves the switch for the loop's next
// iteration, so the next case is unreachable. Locks the continue branch of
// the completion analysis.
//
// 1. End a case with a bare `continue;` inside a loop-wrapped switch.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsContinueTerminatingCase(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const a: boolean;
while (a) {
  switch (foo) {
    case 0:
      console.log(0);
      continue;
    case 1:
      console.log(1);
  }
}
`, "")
}
