package linthost

import "testing"

// TestNoElseReturnReportsPlainElseAfterReturn verifies the canonical positive:
// a plain `else` block after a returning `if` branch is reported on the `else`.
//
// This is the invalid row of the issue #598 matrix and the rule's headline
// behavior: the `if` branch returns, so the `else` body can be flattened. The
// finding must land on the `else` block, not the `if` or the whole statement.
//
// 1. Write `if (a) { return 1; } else { return 2; }`.
// 2. Run the engine with no-else-return enabled (default options).
// 3. Assert exactly one finding spanning the `else` block.
func TestNoElseReturnReportsPlainElseAfterReturn(t *testing.T) {
  assertRuleFindingRanges(t, "no-else-return", `declare const a: boolean;
function pick(): number {
  if (a) { return 1; } else { return 2; }
}
JSON.stringify(pick);
`, "{ return 2; }")
}
