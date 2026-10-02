package linthost

import "testing"

// TestCommandFormatNestedTernaryIndent covers Prettier 3's nested-ternary
// staircase: the outermost chain indents its arms by tabWidth. A nested chain in
// the ALTERNATE (`: `) position indents a fixed 2 columns past its parent rung;
// a CONSEQUENT (`? `) position nested chain indents by max(2, tabWidth)
// (Prettier's extra align(tabWidth-2)). The cases here are all alternate-position,
// so at tabWidth 4 their nested arms sit at column 6; they coincide at tabWidth 2.
//
//  1. Format already-correct broken ternary chains (three levels at tabWidth 2
//     and 4, a single ternary at tabWidth 4) and require them unchanged.
//  2. Format a nested chain over-indented by a full tab width at tabWidth 4
//     and require the 2-column rung.
//
// @evidence contracts/testing.md#behavioral-verification Four subcases run the in-process `format` command on broken ternary chains: a three-level chain at tabWidth 2 and 4 and a single ternary at tabWidth 4 must stay unchanged, and a nested chain over-indented by a full tab width at tabWidth 4 must be re-indented to a 2-column rung.
// @evidence contracts/testing.md#independent-expectations Sources and the single expected rewrite are authored literals reasoned from the stated Prettier staircase rule (outer arms at tabWidth, alternate-position nested arms a fixed 2 columns deeper); nothing is derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases Distinguishes tabWidth 2 from 4, nested from single chains, and an already-correct chain from an over-indented one (the only input that must change). Consequent-position nesting is not covered.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via the assertFormat helpers; no child process, built binary or installed consumer.
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
