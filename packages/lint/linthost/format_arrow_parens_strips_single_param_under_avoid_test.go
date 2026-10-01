package linthost

import "testing"

// TestFormatArrowParensStripsSingleParamUnderAvoid verifies prefer:"avoid"
// removes the parentheses around a single bare-identifier arrow parameter.
//
//  1. Parse `(x) => x`.
//  2. Apply format/arrow-parens with prefer:"avoid".
//  3. Assert it becomes `x => x`.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must remove a singleton identifier parameter wrapper under avoid while keeping the const binding and identity arrow body unchanged.
// @evidence contracts/testing.md#independent-expectations The avoid policy independently allows bare x here; the literal expected complete source preserves every non-parenthesis token and the original arrow meaning.
// @evidence contracts/testing.md#distinguishing-cases The wrapped eligible singleton must change; typed/destructured and comment-bearing singleton cases own the adjacent ineligible negatives.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensStripsSingleParamUnderAvoid is selected by TestSelectedLintUnits as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatArrowParensStripsSingleParamUnderAvoid(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const a = (x) => x;\n",
    `{"prefer":"avoid"}`,
    "const a = x => x;\n",
  )
}
