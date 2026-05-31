package linthost

import "testing"

// TestCommandFormatNestedTernaryIndent covers Prettier 3's nested-ternary
// staircase: the outermost chain indents its arms by tabWidth, but each nested
// chain indents a FIXED 2 columns past its parent rung, independent of
// tabWidth. So at tabWidth 4 the outer arms sit at column 4 and successive
// nested arms at 6, 8 — not 8, 12.
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
