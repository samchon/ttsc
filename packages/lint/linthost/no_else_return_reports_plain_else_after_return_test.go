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
//
// @evidence contracts/testing.md#behavioral-verification Engine requires the complete else block range for the original direct return-before-else pair.
// @evidence contracts/testing.md#independent-expectations The authored returning first branch independently makes the plain else disallowed by this style rule; the literal block supplies the range oracle.
// @evidence contracts/testing.md#distinguishing-cases The plain else reports; break/continue/throw and nonterminal else-if policy exclusions are owned by their dedicated counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoElseReturnReportsPlainElseAfterReturn is selected in the shared Go unit population. It calls assertRuleFindingRanges for no-else-return with the authored complete return-2 block target. No installed consumer, native artifact build or real product host runs.
func TestNoElseReturnReportsPlainElseAfterReturn(t *testing.T) {
  assertRuleFindingRanges(t, "no-else-return", `declare const a: boolean;
function pick(): number {
  if (a) { return 1; } else { return 2; }
}
JSON.stringify(pick);
`, "{ return 2; }")
}
