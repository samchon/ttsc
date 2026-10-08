package driver_test

import "testing"

// TestDriverSpliceCallIgnoresClosingParenInsideLineComment Verifies line
// comments do not terminate call scanning.
//
// This scenario targets the line-comment boundary of the actual output owner
// because a commented `)` can truncate the rewrite range unless scanning resumes
// after the newline before closing the original call.
//
// 1. Splice a plugin call with a line comment inside the argument list.
// 2. Include a closing parenthesis character in that line comment.
// 3. Assert the replacement consumes the complete call expression.
//
// @evidence contracts/testing.md#behavioral-verification The output owner consumes the complete call across a line-comment parenthesis.
// @evidence contracts/testing.md#independent-expectations The whole literal const out assignment supplies independent expected bytes.
// @evidence contracts/testing.md#distinguishing-cases Comment-contained close followed by another argument differs from the real delimiter.
// @evidence contracts/testing.md#execution-ownership The Go unit invokes actual applyRewrites through spliceForTest, which supplies a parsed filename identity and independently requires the real header marker before returning the call body for existing exact assertions. It starts no compiler host or runtime process.
func TestDriverSpliceCallIgnoresClosingParenInsideLineComment(t *testing.T) {
  got := spliceForTest(t, "const out = plugin.make(\n  1, // )\n  2\n);")
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}
