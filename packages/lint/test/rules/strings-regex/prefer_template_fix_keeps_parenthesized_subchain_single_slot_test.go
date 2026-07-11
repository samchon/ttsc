package linthost

import "testing"

// TestFixPreferTemplateKeepsParenthesizedSubchainSingleSlot verifies
// that an explicitly parenthesized sub-chain stays one `${…}` slot:
// `(a + b) + " s"` → “ `${(a + b)} s` “.
//
// The author's grouping is semantically load-bearing — `(a + b)` may be
// numeric addition — and the flattener must not descend through a
// ParenthesizedExpression even though the inner node is a `+` chain.
// This pins the paren-leaf branch alongside the new containment gate so
// neither regresses the other.
//
// 1. Snapshot a chain whose left operand is a parenthesized `+` chain.
// 2. Apply `prefer-template` fix.
// 3. Assert the parenthesized sub-chain renders as one slot, verbatim.
func TestFixPreferTemplateKeepsParenthesizedSubchainSingleSlot(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst b: any = 2;\nconst s = (a + b) + \" s\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst b: any = 2;\nconst s = `${(a + b)} s`;\nJSON.stringify(s);\n",
  )
}
