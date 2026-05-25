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
func TestNoLossOfPrecisionRejectsHugeDecimalInteger(t *testing.T) {
  huge := "1" + strings.Repeat("0", 309)
  if !numericLiteralLosesPrecision(huge) {
    t.Fatal("huge decimal integer should report precision loss")
  }
  assertRuleCorpusCase(
    t,
    "no-loss-of-precision-huge-decimal-integer.ts",
    "// expect: noLossOfPrecision error\nconst huge = "+huge+";\nJSON.stringify(huge);\n",
  )
}
