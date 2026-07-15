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
