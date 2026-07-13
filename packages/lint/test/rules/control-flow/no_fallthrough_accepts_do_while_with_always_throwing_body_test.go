package linthost

import "testing"

// TestNoFallthroughAcceptsDoWhileWithAlwaysThrowingBody verifies a do/while whose body always throws terminates the case.
//
// Upstream valid case `do { throw 0; } while (a);`: the body runs at least
// once and never completes an iteration, so the loop test (and everything
// after the loop) is unreachable. Locks the body-runs-first rule of the
// do/while branch.
//
// 1. End a case with `do { throw ...; } while (a);`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsDoWhileWithAlwaysThrowingBody(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const a: boolean;
switch (foo) {
  case 0:
    do {
      throw new Error("boom");
    } while (a);
  case 1:
    console.log(1);
    break;
}
`, "")
}
