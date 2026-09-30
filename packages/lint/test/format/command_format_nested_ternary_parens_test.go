package linthost

import "testing"

// TestCommandFormatNestedTernaryParens pins Prettier's ternary-old printer rule
// (default, non-experimental): a ternary nested in the CONSEQUENT (`?`) position
// of another ternary is wrapped in parentheses when the chain renders flat, and
// the parens drop for the broken staircase. A ternary nested in the ALTERNATE
// (`:`) position chains without parens.
//
//  1. Exercise the authored command format nested ternary parens fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises nested ternary parens and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: consequent_nested_flat_parens, consequent_nested_member_test_parens, alternate_nested_no_parens, consequent_nested_broken_no_parens, consequent_source_parens_join_staircase, alternate_source_parens_chain. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatNestedTernaryParens owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
    assertFormatUnchanged(t, `const x = aaaaaaaaaaaaaaaaaaa
  ? bbbbbbbbbbbbbbb
    ? ccccccccccccccc
    : ddddddddddddddd
  : eeeeeeeeeeeeeeeeeeeeeeeee;
`)
  })
  // Likewise an alternate-position nested ternary with source parens chains
  // (parens dropped).
  t.Run("alternate_source_parens_chain", func(t *testing.T) {
    assertFormatUnchanged(t, `const y = aaaaaaaaaaaaaaaaaaa
  ? bbbbbbbbbbbbbbb
  : ccccccccccccccc
    ? ddddddddddddddd
    : eeeeeeeeeeeeeeeeeeeeeeeee;
`)
  })
}
