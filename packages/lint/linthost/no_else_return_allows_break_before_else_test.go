package linthost

import "testing"

// TestNoElseReturnAllowsBreakBeforeElse verifies a `break` in the `if` branch
// does not make the following `else` redundant.
//
// Regression for issue #598: the port treated `break` as a return-equivalent
// terminator and flagged the `else`. Upstream `checkForReturn` matches only a
// `ReturnStatement`, so a loop `break` is not a terminator here.
//
// 1. Write a `for (;;)` whose body is `if (a) { break; } else { g(); }`.
// 2. Run the engine with no-else-return enabled (default options).
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings when the preceding branch breaks a loop rather than returning.
// @evidence contracts/testing.md#independent-expectations The supported rule policy specifically matches return, so an independently authored break does not trigger redundant-else reporting; this is a policy exclusion rather than a runtime reachability proof.
// @evidence contracts/testing.md#distinguishing-cases Loop break-before-else stays clean; ReportsPlainElseAfterReturn supplies the actual return counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoElseReturnAllowsBreakBeforeElse is selected in the shared Go unit population. It calls assertRuleSkipsSource with the complete loop fixture and no-else-return Engine. No installed consumer, native artifact build or real product host runs.
func TestNoElseReturnAllowsBreakBeforeElse(t *testing.T) {
  assertRuleSkipsSource(t, "no-else-return", `declare const a: boolean;
declare function g(): void;
function loop(): void {
  for (;;) {
    if (a) {
      break;
    } else {
      g();
    }
  }
}
JSON.stringify(loop);
`)
}
