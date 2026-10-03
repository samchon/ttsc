package linthost

import "testing"

// TestFormatArrowParensStripsTrailingCommaParamUnderAvoid verifies
// prefer:"avoid" removes the parentheses *and* the legal trailing comma of a
// single bare-identifier parameter: `(x,) => x` becomes `x => x`, matching
// Prettier.
//
// The current edit replaces the enclosing parameter span with the name alone,
// including removal of the trailing comma. Each full expected source forbids
// retaining that comma, which is not part of bare-identifier arrow syntax.
//
//  1. Parse a trailing-comma single-parameter arrow (plain, async, and
//     multiline variants).
//  2. Apply format/arrow-parens with prefer:"avoid".
//  3. Assert parens and comma are gone: `x => x`.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must remove both parentheses and the parameter trailing comma for eligible singleton arrows under avoid, retaining modifier and body meaning.
// @evidence contracts/testing.md#independent-expectations The three independently authored complete output literals are legal bare-identifier arrows; leaving the comma would yield invalid x-comma-arrow syntax.
// @evidence contracts/testing.md#distinguishing-cases This host owns single_line, async and multiline transformations. Matching always-mode no-op twins and ineligible/commented comma cases prevent eligibility expansion.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensStripsTrailingCommaParamUnderAvoid is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and applies reported edits for snapshots; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensStripsTrailingCommaParamUnderAvoid(t *testing.T) {
  t.Run("single_line", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x,) => x;\n",
      `{"prefer":"avoid"}`,
      "const a = x => x;\n",
    )
  })
  t.Run("async", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "format/arrow-parens",
      "const a = async (x,) => x;\n",
      `{"prefer":"avoid"}`,
      "const a = async x => x;\n",
    )
  })
  t.Run("multiline", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "format/arrow-parens",
      "const a = (\n  x,\n) => x;\n",
      `{"prefer":"avoid"}`,
      "const a = x => x;\n",
    )
  })
}
