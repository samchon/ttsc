package linthost

import "testing"

// TestFormatArrowParensAbstainsOnParamComment pins the data-safety guard: under
// prefer:"always" (the default), a single bare-identifier parameter that already
// carries a comment must be left untouched. The whitespace-only paren scan stops
// at the comment byte and would otherwise mis-report "not wrapped", wrapping an
// already-parenthesized name a second time into invalid `(/* c */ (x)) => x`.
// Prettier leaves such an arrow alone (canPrintParamsWithoutParens requires
// `!hasComment(parameters[0])`), so the rule must report nothing.
func TestFormatArrowParensAbstainsOnParamComment(t *testing.T) {
  t.Run("leading_comment", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (/* c */ x) => x;\n",
      `{"prefer":"always"}`,
    )
  })
  t.Run("trailing_comment", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x /* c */) => x;\n",
      `{"prefer":"always"}`,
    )
  })
}
