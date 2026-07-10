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
