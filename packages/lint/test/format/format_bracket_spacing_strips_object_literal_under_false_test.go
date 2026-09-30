package linthost

import "testing"

// TestFormatBracketSpacingStripsObjectLiteralUnderFalse verifies
// bracketSpacing:false removes the inner space of a single-line object
// literal.
//
//  1. Parse `{ x: 1 }`.
//  2. Apply format/bracket-spacing with spacing:false.
//  3. Assert it becomes `{x: 1}`.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must remove both brace-interior spaces from a nonempty object under spacing:false.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves x:1 and its declaration while using the zero-padding form independently specified by spacing:false. The added literal output normalizes mixed ASCII/NBSP brace trivia while preserving the NBSP inside the string value byte-for-byte.
// @evidence contracts/testing.md#distinguishing-cases This inverse positive distinguishes the false option from spacing:true padding; the empty-object test checks that neither option invents content for {}. The added nonempty Unicode fixture distinguishes boundary trivia from identical significant characters inside a literal.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingStripsObjectLiteralUnderFalse is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingStripsObjectLiteralUnderFalse(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "const a = { x: 1 };\n",
    `{"spacing":false}`,
    "const a = {x: 1};\n",
  )
  assertFixSnapshotWithOptions(t, "format/bracket-spacing", "const a = { \u00a0x: \"\u00a0\"\u00a0 };\n", `{"spacing":false}`, "const a = {x: \"\u00a0\"};\n")
}
