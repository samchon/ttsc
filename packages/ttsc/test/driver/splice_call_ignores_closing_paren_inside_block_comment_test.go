package driver_test

import "testing"

// TestDriverSpliceCallIgnoresClosingParenInsideBlockComment verifies block
// comments do not terminate call scanning.
//
// This scenario covers the comment branch directly through the splice helper
// because a closing parenthesis inside a block comment should not be counted as
// the end of the call argument list.
//
// 1. Splice a plugin call whose argument list contains a block comment.
// 2. Include a closing parenthesis character inside that comment.
// 3. Assert the full call is replaced rather than stopping at the comment.
func TestDriverSpliceCallIgnoresClosingParenInsideBlockComment(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(1 /* ) */, 2);`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}
