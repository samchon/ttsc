package linthost

import "testing"

// TestFormatArrowParensAbstainsOnCommentNearTrailingComma pins the data-safety
// guard around a trailing-comma parameter list that also carries a comment: on
// either side of the comma (`(x /* c */,)`, `(x, /* c */)`) the rule must
// report nothing in both modes. "avoid" would otherwise delete the comment
// with the `( … )` span, and "always" would mis-read `(x, /* c */)` as a bare
// parameter (the comment byte aborts the forward paren scan) and double-wrap
// it. Prettier declines to drop parens on a commented parameter
// (canPrintParamsWithoutParens requires `!hasComment(parameters[0])`), so
// abstaining is oracle-safe.
//
//  1. Parse trailing-comma arrows with a comment before/after the comma, plus
//     the comma-free `(x /* c */) => x` twin under "avoid".
//  2. Run format/arrow-parens in each mode.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must offer no finding for a commented singleton with a trailing comma, retaining comment ownership under always and avoid modes.
// @evidence contracts/testing.md#independent-expectations Each literal parameter list places a real comment before or after its comma; deleting that span or wrapping through it violates the independently specified comment-preservation guard.
// @evidence contracts/testing.md#distinguishing-cases All four comma-side/mode combinations and the comma-free avoid twin execute in this host. The separate trailing-comma stripping case owns eligible un-commented transformation.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensAbstainsOnCommentNearTrailingComma is selected by TestSelectedLintUnits as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatArrowParensAbstainsOnCommentNearTrailingComma(t *testing.T) {
  t.Run("comment_before_comma_always", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x /* c */,) => x;\n",
      `{"prefer":"always"}`,
    )
  })
  t.Run("comment_before_comma_avoid", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x /* c */,) => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
  t.Run("comment_after_comma_always", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x, /* c */) => x;\n",
      `{"prefer":"always"}`,
    )
  })
  t.Run("comment_after_comma_avoid", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x, /* c */) => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
  // Comma-free negative twin: the trailing-comment guard must keep firing for
  // `(x /* c */) => x` under "avoid" (the "always" twin lives in
  // format_arrow_parens_abstains_on_param_comment_test.go).
  t.Run("comment_no_comma_avoid", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x /* c */) => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
}
