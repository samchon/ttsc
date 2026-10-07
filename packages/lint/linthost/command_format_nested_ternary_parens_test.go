package linthost

import "testing"

// TestCommandFormatNestedTernaryParens pins Prettier's ternary-old printer rule
// (default, non-experimental): a ternary nested in the CONSEQUENT (`?`) position
// of another ternary is wrapped in parentheses when the chain renders flat, and
// the parens drop for the broken staircase. A ternary nested in the ALTERNATE
// (`:`) position chains without parens.
//
//  1. Format four canonical nested ternaries (flat consequent-nested with
//     parentheses, flat alternate-nested without, broken consequent-nested
//     without) and require them unchanged.
//  2. Format two broken ternaries whose source parenthesizes the nested ternary
//     and require the paren-free staircase.
//
// @evidence contracts/testing.md#behavioral-verification Six subcases run the in-process `format` command: flat consequent-nested ternaries keep their parentheses, a flat alternate-nested chain has none, a broken consequent-nested staircase has none, and parenthesized nested ternaries written in the source (consequent and alternate position, broken layout) must be rewritten to the paren-free staircase.
// @evidence contracts/testing.md#independent-expectations Sources and expected outputs are authored literals following the stated Prettier ternary rule (parens only for a flat consequent-nested ternary); the two source-paren cases carry the parenthesized input and the paren-free expected text.
// @evidence contracts/testing.md#distinguishing-cases Separates consequent from alternate position, flat from broken rendering, and member-expression from simple tests. Four cases are fixed points; the two source-paren cases are the inputs that must change.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged or assertFormatResult; no child process, built binary or installed consumer.
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
  // A nested ternary written with EXPLICIT source parens in the consequent
  // joins the broken staircase (parens dropped), same as a bare nested ternary
  // — Prettier's AST has no parenthesized-expression node.
  t.Run("consequent_source_parens_join_staircase", func(t *testing.T) {
    assertFormatResult(t, `const x = aaaaaaaaaaaaaaaaaaa
  ? (bbbbbbbbbbbbbbb
    ? ccccccccccccccc
    : ddddddddddddddd)
  : eeeeeeeeeeeeeeeeeeeeeeeee;
`, `const x = aaaaaaaaaaaaaaaaaaa
  ? bbbbbbbbbbbbbbb
    ? ccccccccccccccc
    : ddddddddddddddd
  : eeeeeeeeeeeeeeeeeeeeeeeee;
`)
  })
  // Likewise an alternate-position nested ternary with source parens chains
  // (parens dropped).
  t.Run("alternate_source_parens_chain", func(t *testing.T) {
    assertFormatResult(t, `const y = aaaaaaaaaaaaaaaaaaa
  ? bbbbbbbbbbbbbbb
  : (ccccccccccccccc
    ? ddddddddddddddd
    : eeeeeeeeeeeeeeeeeeeeeeeee);
`, `const y = aaaaaaaaaaaaaaaaaaa
  ? bbbbbbbbbbbbbbb
  : ccccccccccccccc
    ? ddddddddddddddd
    : eeeeeeeeeeeeeeeeeeeeeeeee;
`)
  })
}
