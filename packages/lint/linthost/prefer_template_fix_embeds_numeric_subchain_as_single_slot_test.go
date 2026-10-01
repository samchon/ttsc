package linthost

import "testing"

// TestFixPreferTemplateEmbedsNumericSubchainAsSingleSlot verifies that a
// `+` subtree with no string-like operand stays one `${"" + (…)}` slot:
// `a + b + " items"` → “ `${"" + (a + b)} items` “.
//
// Left-associativity makes the chain `(a + b) + " items"`, so `a + b`
// evaluates BEFORE the string concatenation — numeric addition for
// numbers. Flattening it into `${"" + (a)}${"" + (b)}` silently changes the runtime
// value (3 becomes "12" for a=1, b=2). Upstream ESLint prefer-template
// embeds the non-string sub-chain as a single expression; this pins the
// flattening gate in `flattenConcatOperands`.
//
// 1. Snapshot a chain whose left sub-chain contains no string literal.
// 2. Apply `prefer-template` fix.
// 3. Assert the sub-chain renders as one `${"" + (a + b)}` slot.
//
// @evidence contracts/testing.md#behavioral-verification Fixes a+b followed by a string suffix using one arithmetic interpolation.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
// @evidence contracts/testing.md#independent-expectations ECMAScript left-associative + evaluates numeric a+b before string conversion; the literal expected ${"" + (a + b)} retains that order.
// @evidence contracts/testing.md#distinguishing-cases A numeric leading subchain contrasts with separate slots after a leading string in TestFixPreferTemplateFlattensOperandsAfterLeadingString.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateEmbedsNumericSubchainAsSingleSlot(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst b: any = 2;\nconst s = a + b + \" items\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst b: any = 2;\nconst s = `${\"\" + (a + b)} items`;\nJSON.stringify(s);\n",
  )
}
