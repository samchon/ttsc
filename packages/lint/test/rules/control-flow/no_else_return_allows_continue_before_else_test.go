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
