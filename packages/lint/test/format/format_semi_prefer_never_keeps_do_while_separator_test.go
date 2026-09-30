package linthost

import "testing"

// TestFormatSemiPreferNeverKeepsDoWhileSeparator verifies the `;` between
// a single-statement do-body and its same-line `while` is kept under
// semi:false.
//
// In `do f(); while (x);` the first `;` terminates the body expression
// statement; without a line terminator before `while`, ASI cannot
// replace it, so stripping yields the SyntaxError `do f() while (x)`.
// The statement's own trailing `;` at end of file stays strippable —
// this is the positive/negative pair inside one fixture.
//
//  1. Parse `do f(); while (x);` (single line).
//  2. Apply format/semi with prefer:"never".
//  3. Assert the body separator survives and only the do-statement's
//     final `;` is stripped.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must preserve the single-statement do-body separator before same-line while while removing the safe trailing do-statement terminator.
// @evidence contracts/testing.md#independent-expectations The independently authored full output retains valid do/while grammar: the body call remains terminated before while, and the final EOF boundary needs no optional semicolon.
// @evidence contracts/testing.md#distinguishing-cases One required body separator and one removable final terminator share a changed/retained pair, contrasting with same-line closing-brace safe removal.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverKeepsDoWhileSeparator is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning semicolon rule and applies edits for exact output in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiPreferNeverKeepsDoWhileSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "do f(); while (x);\n",
    `{"prefer":"never"}`,
    "do f(); while (x)\n",
  )
}
