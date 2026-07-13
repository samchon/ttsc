package linthost

import "testing"

// TestNoFallthroughAcceptsBreakingCatchAfterThrowingTry verifies try-always-throws plus catch-always-breaks terminates the case.
//
// Upstream valid case `try { throw 0; } catch (err) { break; }`: neither the
// try block nor the catch block can complete normally, so the case end is
// unreachable. Locks the try-or-catch normal-completion join of
// tryCompletion.
//
// 1. End a case with a throwing try and a breaking catch.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsBreakingCatchAfterThrowingTry(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    try {
      throw new Error("boom");
    } catch {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
