package linthost

import "testing"

// TestFormatBracketSpacingPadsObjectLiteral verifies bracketSpacing:true (the
// default, matching Prettier) adds one inner space to a single-line object
// literal.
//
//  1. Parse `{x: 1}`.
//  2. Apply format/bracket-spacing with spacing:true.
//  3. Assert it becomes `{ x: 1 }`.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must add the configured single inner space at each side of the nonempty object literal.
// @evidence contracts/testing.md#independent-expectations The full literal outputs add exactly the two ASCII spaces demanded by spacing:true to `{x: 1}`, and, for the second input whose brace-adjacent trivia is only NBSP characters, replace each NBSP with one ASCII space while leaving the NBSP inside the string value byte-for-byte.
// @evidence contracts/testing.md#distinguishing-cases The unpadded `{x: 1}` positive pairs with TestFormatBracketSpacingIdempotentOnPadded; the NBSP-trivia input distinguishes brace-adjacent whitespace from the identical significant NBSP inside the string literal. The spacing:false inverse and the empty object are owned by other tests.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingPadsObjectLiteral is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingPadsObjectLiteral(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "const a = {x: 1};\n",
    `{"spacing":true}`,
    "const a = { x: 1 };\n",
  )
  assertFixSnapshotWithOptions(t, "format/bracket-spacing", "const a = {\u00a0x: \"\u00a0\"\u00a0};\n", `{"spacing":true}`, "const a = { x: \"\u00a0\" };\n")
}
