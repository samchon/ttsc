package driver_test

import "testing"

// TestDriverSpliceCallIgnoresClosingParenInsideLineComment Verifies line
// comments do not terminate call scanning.
//
// This scenario targets the line-comment branch of the private splice helper
// because a commented `)` can truncate the rewrite range unless scanning resumes
// after the newline before closing the original call.
//
// 1. Splice a plugin call with a line comment inside the argument list.
// 2. Include a closing parenthesis character in that line comment.
// 3. Assert the replacement consumes the complete call expression.
//
// @evidence contracts/testing.md#behavioral-verification The linked splice helper consumes the complete call across a line-comment parenthesis.
// @evidence contracts/testing.md#independent-expectations The whole literal const out assignment supplies independent expected bytes.
// @evidence contracts/testing.md#distinguishing-cases Comment-contained close followed by another argument differs from the real delimiter.
// @evidence contracts/testing.md#execution-ownership Go unit TestDriverSpliceCallIgnoresClosingParenInsideLineComment is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestDriverSpliceCallIgnoresClosingParenInsideLineComment(t *testing.T) {
  got := spliceForTest(t, "const out = plugin.make(\n  1, // )\n  2\n);")
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}
