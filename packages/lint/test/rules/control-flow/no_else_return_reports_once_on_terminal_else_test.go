package linthost

import "testing"

// TestNoElseReturnReportsOnceOnTerminalElseOfChain verifies a three-branch
// `return` chain reports exactly once, on the terminal `else`.
//
// Secondary regression for issue #598: the port reported on every link of the
// chain (two findings) instead of once. Upstream walks the whole chain from its
// head and reports a single diagnostic on the final `else` when every earlier
// consequent returns.
//
// 1. Write `if (a) return 1; else if (b) return 2; else return 3;`.
// 2. Run the engine with no-else-return enabled (default options).
// 3. Assert exactly one finding spanning the final `else`'s `return 3;`.
func TestNoElseReturnReportsOnceOnTerminalElseOfChain(t *testing.T) {
  assertRuleFindingRanges(t, "no-else-return", `declare const a: boolean;
declare const b: boolean;
function pick(): number {
  if (a) return 1;
  else if (b) return 2;
  else return 3;
}
JSON.stringify(pick);
`, "return 3;")
}
