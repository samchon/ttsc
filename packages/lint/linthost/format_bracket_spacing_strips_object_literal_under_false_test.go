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
// @evidence contracts/testing.md#independent-expectations The full literal outputs remove all brace-adjacent whitespace under spacing:false: `{ x: 1 }` becomes `{x: 1}`, and the mixed ASCII-and-NBSP trivia input becomes `{x: " "}` with the NBSP inside the string preserved byte-for-byte.
// @evidence contracts/testing.md#distinguishing-cases The inverse of the padding positive; the second input distinguishes brace-adjacent mixed ASCII/NBSP trivia (removed) from the identical NBSP inside a string literal (kept). The empty-object test owns the no-interior boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingStripsObjectLiteralUnderFalse is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
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
