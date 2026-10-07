package linthost

import "testing"

// TestNoElseReturnAllowsThrowBeforeElse verifies a `throw` in the `if` branch
// does not make the following `else` redundant.
//
// Regression for issue #598: the port treated `throw` as a return-equivalent
// terminator and flagged the `else`. Upstream `checkForReturn` matches only a
// `ReturnStatement`, so `throw` is not a terminator here and the `else` stays.
//
// 1. Write `if (a) { throw new Error("x"); } else { g(); }`.
// 2. Run the engine with no-else-return enabled (default options).
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for an original throw-before-else branch.
// @evidence contracts/testing.md#independent-expectations The supported style rule recognizes return, not every abrupt completion; the authored throw remains a deliberate policy exclusion.
// @evidence contracts/testing.md#distinguishing-cases Throw-before-else stays clean; the plain-return case owns the differing terminator that reports.
// @evidence contracts/testing.md#execution-ownership TestNoElseReturnAllowsThrowBeforeElse is selected in the shared Go unit population. It calls assertRuleSkipsSource on the authored throw fixture with no-else-return Engine. No installed consumer, native artifact build or real product host runs.
func TestNoElseReturnAllowsThrowBeforeElse(t *testing.T) {
  assertRuleSkipsSource(t, "no-else-return", `declare const a: boolean;
declare function g(): void;
function h(): void {
  if (a) {
    throw new Error("x");
  } else {
    g();
  }
}
JSON.stringify(h);
`)
}
