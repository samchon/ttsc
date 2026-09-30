package linthost

import "testing"

// TestFormatSemiInsertsMemberTerminatorBeforeTrailingComment verifies the
// terminator lands at the member's end rather than at the end of its line.
//
// The edit is zero-width at End(), which sits before the member's trailing
// trivia, so a `// note` after the member keeps its position and its text.
// The comment is also what proves the line-structure test crosses trivia:
// the next significant byte is the `}` a line below, and scanPastTrivia has
// to walk the comment to see that break.
//
//  1. Parse an interface member followed by a line comment.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert the `;` lands before the comment and the comment survives.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must insert the broken interface member terminator before its trailing line comment while retaining note and all source lines.
// @evidence contracts/testing.md#independent-expectations The independently authored full output places the semicolon after the string annotation and before the line-comment bytes, following ordinary member comment ownership.
// @evidence contracts/testing.md#distinguishing-cases This changed line-comment member contrasts with bare-member insertion and mapped-type comment placement; the latter owns both line and block attachment differences.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiInsertsMemberTerminatorBeforeTrailingComment is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiInsertsMemberTerminatorBeforeTrailingComment(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "interface Shape {\n  value: string // note\n}\n",
    "interface Shape {\n  value: string; // note\n}\n",
  )
}
