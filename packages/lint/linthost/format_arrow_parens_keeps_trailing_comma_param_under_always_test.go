package linthost

import "testing"

// TestFormatArrowParensKeepsTrailingCommaParamUnderAlways verifies
// prefer:"always" treats a single parameter followed by a legal trailing comma
// (`(x,) => x`) as already parenthesized.
//
// Pins the wrappedness detection in
// `rules_format_arrow_parens.go::formatArrowParens.Check`: the forward paren
// scan used to start at the parameter *name*'s end, where the `,` byte aborted
// the whitespace-only scan, misclassified the parameter as bare, and wrapped
// the name a second time into invalid `((x),) => x` (a parenthesized pattern
// is not a valid parameter). Scanning from the parameter list's end — whose
// span covers the trailing comma — classifies it as wrapped.
//
//  1. Parse a trailing-comma single-parameter arrow (plain, async, and
//     multiline variants).
//  2. Run format/arrow-parens with prefer:"always".
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must recognize an existing wrapper around comma-bearing singleton parameters and avoid double wrapping under always.
// @evidence contracts/testing.md#independent-expectations Each literal parameter list already has balanced parentheses and a legal trailing comma; the policy permits that existing wrapper without another edit.
// @evidence contracts/testing.md#distinguishing-cases This host owns single_line, async and multiline no-finding cases; avoid-mode stripping of the same three shapes is the separately owned changed counterpart.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensKeepsTrailingCommaParamUnderAlways is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and observes zero findings without applying any edit; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensKeepsTrailingCommaParamUnderAlways(t *testing.T) {
  t.Run("single_line", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x,) => x;\n",
      `{"prefer":"always"}`,
    )
  })
  t.Run("async", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = async (x,) => x;\n",
      `{"prefer":"always"}`,
    )
  })
  t.Run("multiline", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (\n  x,\n) => x;\n",
      `{"prefer":"always"}`,
    )
  })
}
