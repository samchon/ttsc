package linthost

import "testing"

// TestCommandFormatNestedTernaryIndent covers Prettier 3's nested-ternary
// staircase: the outermost chain indents its arms by tabWidth. A nested chain in
// the ALTERNATE (`: `) position indents a fixed 2 columns past its parent rung;
// a CONSEQUENT (`? `) position nested chain indents by max(2, tabWidth)
// (Prettier's extra align(tabWidth-2)). The cases here are all alternate-position,
// so at tabWidth 4 their nested arms sit at column 6; they coincide at tabWidth 2.
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
