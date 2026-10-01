package linthost

import "testing"

// TestFormatArrowParensKeepsIneligibleTrailingCommaParams verifies
// prefer:"avoid" still leaves every ineligible single-parameter shape alone
// when a legal trailing comma follows it: typed `(x: T,)`, defaulted
// `(x = 1,)`, destructured `({ x },)`, and a generic arrow `<T>(x,)`.
//
// These shapes are excluded by `isBareIdentifierParam` (or the
// type-parameter guard) *before* the trailing-comma-aware wrappedness scan
// runs, so making `(x,)` strippable must not have widened "avoid" onto
// parameters whose parens are mandatory — a bare `x: T =>` or `{ x } =>` is
// not valid syntax.
//
//  1. Parse each ineligible trailing-comma arrow.
//  2. Run format/arrow-parens with prefer:"avoid".
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must emit no finding for typed, defaulted, destructured and generic singleton parameters carrying a trailing comma under avoid.
// @evidence contracts/testing.md#independent-expectations The independently supplied binding/type/default syntax makes parentheses mandatory regardless of comma tolerance; the default value one and generic annotation must survive.
// @evidence contracts/testing.md#distinguishing-cases This host owns typed, defaulted, destructured and generic subtests. Eligible untyped comma-bearing positive transformations and comment-bearing negatives remain separate owners.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensKeepsIneligibleTrailingCommaParams is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and observes zero findings without applying any edit; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensKeepsIneligibleTrailingCommaParams(t *testing.T) {
  t.Run("typed", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x: number,) => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
  t.Run("defaulted", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = (x = 1,) => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
  t.Run("destructured", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = ({ x },) => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
  t.Run("generic", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/arrow-parens",
      "const a = <T>(x: T,) => x;\n",
      `{"prefer":"avoid"}`,
    )
  })
}
