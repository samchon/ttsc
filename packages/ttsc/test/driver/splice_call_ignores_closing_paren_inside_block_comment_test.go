package driver_test

import "testing"

// TestDriverSpliceCallIgnoresClosingParenInsideBlockComment Verifies that the output owner replaces the entire call despite a closing parenthesis inside a block comment.
//
// The decoy parenthesis is inside a comment before the real call end.
//
// 1. Splice a plugin call whose argument list contains a block comment.
// 2. Include a closing parenthesis character inside that comment.
// 3. Assert the full call is replaced rather than stopping at the comment.
//
// @evidence contracts/testing.md#behavioral-verification the output owner replaces the entire call despite a closing parenthesis inside a block comment.
// @evidence contracts/testing.md#independent-expectations The literal const out = replacement statement independently defines scanner extent.
// @evidence contracts/testing.md#distinguishing-cases The decoy parenthesis is inside a comment before the real call end.
// @evidence contracts/testing.md#execution-ownership The Go unit invokes actual applyRewrites through spliceForTest, which supplies a parsed filename identity and independently requires the real header marker before returning the call body for existing exact assertions. It starts no compiler host or runtime process.
func TestDriverSpliceCallIgnoresClosingParenInsideBlockComment(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(1 /* ) */, 2);`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}
