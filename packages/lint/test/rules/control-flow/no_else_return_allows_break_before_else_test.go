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
