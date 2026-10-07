package linthost

import (
  "strings"
  "testing"
)

// TestNoLossOfPrecisionRejectsHugeDecimalInteger verifies the overflow-scale boundary.
//
// Decimal integer literals longer than any finite JavaScript Number's integer
// text cannot round-trip to the same source text. The predicate should reject
// them directly; the same literal is also a corpus fixture, so the public rule
// path keeps reporting it after parser/source-text extraction.
//
// 1. Build a 310-digit decimal integer literal.
// 2. Check it with the precision-loss predicate.
// 3. Assert the predicate reports precision loss.
//
// @evidence contracts/testing.md#behavioral-verification The predicate rejects the authored 310-digit decimal that exceeds the finite Number magnitude; the rule-level diagnostic for the same literal is owned by the corpus fixture positive/runtime-safety/no-loss-of-precision-huge-decimal-integer.ts that TestLintFixtureCorpus executes.
// @evidence contracts/testing.md#independent-expectations A 310-digit power of ten exceeds the finite Number magnitude bound, independently establishing loss without asking the tested predicate for expected output.
// @evidence contracts/testing.md#distinguishing-cases This owns the overflow-scale predicate decision; the syntax table supplies finite boundary, huge zero-exponent and underflow controls, and the corpus fixture owns source extraction through the engine.
// @evidence contracts/testing.md#execution-ownership TestNoLossOfPrecisionRejectsHugeDecimalInteger is selected in the shared Go unit population and calls numericLiteralLosesPrecision directly on the overflow literal. No consumer install, native artifact build or real product host runs.
func TestNoLossOfPrecisionRejectsHugeDecimalInteger(t *testing.T) {
  huge := "1" + strings.Repeat("0", 309)
  if !numericLiteralLosesPrecision(huge) {
    t.Fatal("huge decimal integer should report precision loss")
  }
}
