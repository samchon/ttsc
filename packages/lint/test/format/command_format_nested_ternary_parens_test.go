package linthost

import "testing"

// TestCommandFormatNestedTernaryParens pins Prettier's ternary-old printer rule
// (default, non-experimental): a ternary nested in the CONSEQUENT (`?`) position
// of another ternary is wrapped in parentheses when the chain renders flat, and
// the parens drop for the broken staircase. A ternary nested in the ALTERNATE
// (`:`) position chains without parens.
func TestCommandFormatNestedTernaryParens(t *testing.T) {
  // Consequent-nested, flat: parens.
  t.Run("consequent_nested_flat_parens", func(t *testing.T) {
    assertFormatUnchanged(t, "const a = cell ? (direction === \"above\" ? index : nextIndex) : index;\n")
  })
  // Consequent-nested with member test, flat: parens.
  t.Run("consequent_nested_member_test_parens", func(t *testing.T) {
    assertFormatUnchanged(t, "const m = isWriteOptions(opts) ? (opts.append ? \"a\" : \"w\") : \"r\";\n")
  })
  // Alternate-nested: chains without parens.
  t.Run("alternate_nested_no_parens", func(t *testing.T) {
    assertFormatUnchanged(t, "const c = outerTest ? whenOuter : innerTest ? whenInner : elseInner;\n")
  })
  // Consequent-nested that overflows: broken staircase, NO parens.
  t.Run("consequent_nested_broken_no_parens", func(t *testing.T) {
    assertFormatUnchanged(t, `const e = condition
  ? veryLongConsequentValueA
    ? deeplyNestedTrue
    : deeplyNestedFalse
  : veryLongAlternateValueHere;
`)
  })
}
