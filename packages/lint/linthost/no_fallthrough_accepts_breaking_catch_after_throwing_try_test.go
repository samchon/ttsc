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
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for an always-throwing try followed by a breaking catch.
// @evidence contracts/testing.md#independent-expectations Both authored completion paths exit the case; the empty expectation excludes a spurious catch join.
// @evidence contracts/testing.md#distinguishing-cases RejectsNormallyCompletingCatch removes the catch break and reports the target.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsBreakingCatchAfterThrowingTry is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
