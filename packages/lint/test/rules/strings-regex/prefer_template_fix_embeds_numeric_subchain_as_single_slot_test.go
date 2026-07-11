package linthost

import "testing"

// TestFixPreferTemplateEmbedsNumericSubchainAsSingleSlot verifies that a
// `+` subtree with no string-like operand stays one `${…}` slot:
// `a + b + " items"` → “ `${a + b} items` “.
//
// Left-associativity makes the chain `(a + b) + " items"`, so `a + b`
// evaluates BEFORE the string concatenation — numeric addition for
// numbers. Flattening it into `${a}${b}` silently changes the runtime
// value (3 becomes "12" for a=1, b=2). Upstream ESLint prefer-template
// embeds the non-string sub-chain as a single expression; this pins the
// flattening gate in `flattenConcatOperands`.
//
// 1. Snapshot a chain whose left sub-chain contains no string literal.
// 2. Apply `prefer-template` fix.
// 3. Assert the sub-chain renders as one `${a + b}` slot.
func TestFixPreferTemplateEmbedsNumericSubchainAsSingleSlot(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst b: any = 2;\nconst s = a + b + \" items\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst b: any = 2;\nconst s = `${a + b} items`;\nJSON.stringify(s);\n",
  )
}
