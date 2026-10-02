package linthost

import "testing"

// TestFormatArrowParensAbstainsOnParamComment pins the data-safety guard: under
// prefer:"always" (the default), a single bare-identifier parameter that already
// carries a comment must be left untouched. The whitespace-only paren scan stops
// at the comment byte and would otherwise mis-report "not wrapped", wrapping an
// already-parenthesized name a second time into invalid `(/* c */ (x)) => x`.
// Prettier leaves such an arrow alone (canPrintParamsWithoutParens requires
// `!hasComment(parameters[0])`), so the rule must report nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must offer no finding for comments before/after a parameter or between its closing parenthesis and arrow, avoiding comment loss or double parentheses.
// @evidence contracts/testing.md#independent-expectations The three literal arrows already carry required comment-bearing parentheses; the independent preservation requirement forbids edits that delete or strand those comments.
// @evidence contracts/testing.md#distinguishing-cases This host owns leading_comment, trailing_comment and avoid_comment_before_arrow. Un-commented wrapping and stripping transformations are owned by their separate positive cases.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensAbstainsOnParamComment is selected by the lint semantic-unit Evidence claim as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
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
  // avoid mode must keep the parens of `(x) /* c */ => x`: the comment sits
  // between `)` and `=>` (a dangling comment on the arrow), and stripping the
  // parens would strand it. Prettier keeps them.
  t.Run("avoid_comment_before_arrow", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x) /* c */ => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
}
