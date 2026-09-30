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
// @evidence contracts/testing.md#independent-expectations The full literal output preserves property x, numeric value 1 and the declaration and adds only the two spaces specified by spacing:true. The added literal output normalizes mixed ASCII/NBSP brace trivia while preserving the NBSP inside the string value byte-for-byte.
// @evidence contracts/testing.md#distinguishing-cases This unpadded-object positive pairs with TestFormatBracketSpacingIdempotentOnPadded; the spacing:false positive owns the inverse operation and the empty-object test owns both option boundaries. The added nonempty Unicode fixture distinguishes boundary trivia from identical significant characters inside a literal.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingPadsObjectLiteral is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
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
