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
