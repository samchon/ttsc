package linthost

import (
  "strings"
  "testing"
)

// TestNoLossOfPrecisionRejectsHugeDecimalInteger verifies the overflow-scale boundary.
//
// Decimal integer literals longer than any finite JavaScript Number's integer
// text cannot round-trip to the same source text. The predicate should reject
// them directly, and the public rule path should still report the diagnostic
// after parser/source-text extraction.
//
// 1. Build a 310-digit decimal integer literal.
// 2. Check it with the precision-loss predicate.
// 3. Run the native rule engine on the same literal.
// 4. Assert the noLossOfPrecision diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification The predicate and owning Engine both reject the same authored 310-digit decimal, retaining the exact annotated rule diagnostic.
// @evidence contracts/testing.md#independent-expectations A 310-digit power of ten exceeds the finite Number magnitude bound, independently establishing loss without asking the tested predicate for expected output.
// @evidence contracts/testing.md#distinguishing-cases This owns overflow-scale source extraction plus predicate behavior; the syntax table supplies finite boundary, huge zero-exponent and underflow controls.
// @evidence contracts/testing.md#execution-ownership TestNoLossOfPrecisionRejectsHugeDecimalInteger is selected in the shared Go unit population. It passes the authored no-loss-of-precision-huge-decimal-integer.ts fixture through assertRuleCorpusCase to the owning AST Engine. It also calls numericLiteralLosesPrecision on the same overflow literal. No consumer install, native artifact build or real product host runs.
func TestNoLossOfPrecisionRejectsHugeDecimalInteger(t *testing.T) {
  huge := "1" + strings.Repeat("0", 309)
  if !numericLiteralLosesPrecision(huge) {
    t.Fatal("huge decimal integer should report precision loss")
  }
  assertRuleCorpusCase(
    t,
    "no-loss-of-precision-huge-decimal-integer.ts",
    "// expect: no-loss-of-precision error\nconst huge = "+huge+";\nJSON.stringify(huge);\n",
  )
}
