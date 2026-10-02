package linthost

import "testing"

// TestFormatBracketSpacingPadsDestructure verifies bracketSpacing:true pads a
// single-line object binding pattern (destructuring).
//
//  1. Parse `const {x, y} = obj`.
//  2. Apply format/bracket-spacing with spacing:true.
//  3. Assert it becomes `const { x, y } = obj`.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must pad a single-line object binding pattern when spacing:true without changing either binding or the source object.
// @evidence contracts/testing.md#independent-expectations The full literal output adds exactly one brace-interior space on each side while preserving x, y and obj, as required by the configured bracket-spacing policy.
// @evidence contracts/testing.md#distinguishing-cases This binding-pattern positive distinguishes the parser's ObjectBindingPattern surface from an object expression; canonical-object and empty-object negatives complement the shared padding decision.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingPadsDestructure is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingPadsDestructure(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "const {x, y} = obj;\n",
    `{"spacing":true}`,
    "const { x, y } = obj;\n",
  )
}
