package linthost

import "testing"

// TestFormatBracketSpacingLeavesEmptyObject verifies an empty `{}` is left
// untouched under both modes — there is no interior to pad, matching
// Prettier (`{}` stays `{}`, never `{ }`).
//
//  1. Parse `const b = {}`.
//  2. Run format/bracket-spacing with spacing:true.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must report no finding for an exactly empty {} object under both spacing:true and spacing:false.
// @evidence contracts/testing.md#independent-expectations The fixed literal has no interior content to pad, and the supported empty-object policy retains {} rather than creating { }; the same literal is asserted under each option.
// @evidence contracts/testing.md#distinguishing-cases The original spacing:true boundary remains and spacing:false is added. Nonempty object positives separately distinguish padding from stripping, so emptiness is not mistaken for a globally disabled rule.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingLeavesEmptyObject is a public Go unit selected by TestSelectedLintUnits. This host owns its literal source and no-finding assertions; the shared syntax-only harness invokes the owning rule in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingLeavesEmptyObject(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/bracket-spacing",
    "const b = {};\n",
    `{"spacing":true}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/bracket-spacing", "const b = {};\n", `{"spacing":false}`)
}
