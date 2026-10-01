package linthost

import "testing"

// TestNoElseReturnAllowsContinueBeforeElse verifies a `continue` in the `if`
// branch does not make the following `else` redundant.
//
// Regression for issue #598: the port treated `continue` as a return-equivalent
// terminator and flagged the `else`. Upstream `checkForReturn` matches only a
// `ReturnStatement`, so a loop `continue` is not a terminator here.
//
// 1. Write a `for (;;)` whose body is `if (a) { continue; } else { g(); }`.
// 2. Run the engine with no-else-return enabled (default options).
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings when the preceding branch continues the loop rather than returning.
// @evidence contracts/testing.md#independent-expectations The supported rule policy specifically matches return; the authored continue is an independently different termination kind.
// @evidence contracts/testing.md#distinguishing-cases Continue-before-else stays clean; the plain-return and terminal-chain cases supply positive counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoElseReturnAllowsContinueBeforeElse is selected in the shared Go unit population. It calls assertRuleSkipsSource with the authored loop fixture and no-else-return Engine. No installed consumer, native artifact build or real product host runs.
func TestNoElseReturnAllowsContinueBeforeElse(t *testing.T) {
  assertRuleSkipsSource(t, "no-else-return", `declare const a: boolean;
declare function g(): void;
function loop(): void {
  for (;;) {
    if (a) {
      continue;
    } else {
      g();
    }
  }
}
JSON.stringify(loop);
`)
}
