package linthost

import "testing"

// TestCommandFormatNestedTernaryIndent covers Prettier 3's nested-ternary
// staircase: the outermost chain indents its arms by tabWidth. A nested chain in
// the ALTERNATE (`: `) position indents a fixed 2 columns past its parent rung;
// a CONSEQUENT (`? `) position nested chain indents by max(2, tabWidth)
// (Prettier's extra align(tabWidth-2)). The cases here are all alternate-position,
// so at tabWidth 4 their nested arms sit at column 6; they coincide at tabWidth 2.
//
//  1. Exercise the authored command format nested ternary indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises nested ternary indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: tab2_three_level_idempotent, tab4_three_level_idempotent, tab4_single_idempotent, tab4_nested_over_indent_reindented. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatNestedTernaryIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatNestedTernaryIndent(t *testing.T) {
  t.Run("tab2_three_level_idempotent", func(t *testing.T) {
    assertFormatUnchanged(t, `const result = firstConditionThatIsLongEnoughToBreakHere
  ? firstConsequentValueExpr
  : secondConditionExpressionValue
    ? secondConsequentValueHere
    : thirdConditionValueExprHere
      ? thirdConsequentValueHere
      : finalAlternateValueExpr;
`)
  })
  t.Run("tab4_three_level_idempotent", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const result = firstConditionThatIsLongEnoughToBreakHere
    ? firstConsequentValueExpr
    : secondConditionExpressionValue
      ? secondConsequentValueHere
      : thirdConditionValueExprHere
        ? thirdConsequentValueHere
        : finalAlternateValueExpr;
`, map[string]any{"tabWidth": 4})
  })
  // single (non-nested) ternary: only the outer arms, at tabWidth, no +2.
  t.Run("tab4_single_idempotent", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const v = someConditionThatIsLongEnoughToForceTheTernaryToBreakHereYes
    ? consequentValueExpressionHere
    : alternateValueExpressionHere;
`, map[string]any{"tabWidth": 4})
  })
  // a nested chain over-indented by a full tabWidth (the old behavior) is
  // re-indented to the fixed +2 rung.
  t.Run("tab4_nested_over_indent_reindented", func(t *testing.T) {
    assertFormatResultWithFormat(t,
      `const result = aLongConditionHereThatBreaksAcrossLinesYesIndeed
    ? consequentValueHere
    : secondConditionExpressionValueHere
        ? nestedConsequentValueHere
        : nestedAlternateValueHere;
`,
      `const result = aLongConditionHereThatBreaksAcrossLinesYesIndeed
    ? consequentValueHere
    : secondConditionExpressionValueHere
      ? nestedConsequentValueHere
      : nestedAlternateValueHere;
`,
      map[string]any{"tabWidth": 4})
  })
}
