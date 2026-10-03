package linthost

import "testing"

// TestFormatArrowParensAbstainsOnParamComment pins the data-safety guard: under
// prefer:"always" (the default), a single bare-identifier parameter that already
// carries a comment must be left untouched by this rule. Its comment guard
// runs before the whitespace-only paren scans. Prettier retains parentheses
// when its parameter or dangling-comment checks prevent omission; that does
// not mean its full formatter output is byte-identical to this fixture.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must offer no finding for comments before/after a parameter or between its closing parenthesis and arrow, avoiding comment loss or double parentheses.
// @evidence contracts/testing.md#independent-expectations The three literal arrows independently specify the rule's comment-region abstention policy; every expected finding list is empty rather than derived from emitted edits.
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
  // avoid mode abstains on `(x) /* c */ => x`: the comment sits between `)`
  // and `=>`. Prettier also retains parens for an attached dangling comment;
  // this assertion observes this rule's finding list, not Prettier output.
  t.Run("avoid_comment_before_arrow", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x) /* c */ => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
}
