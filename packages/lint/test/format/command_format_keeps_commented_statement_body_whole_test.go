package linthost

import "testing"

// TestCommandFormatKeepsCommentedStatementBodyWhole verifies a statement with
// trivia the structured printer cannot safely remint makes its enclosing
// print-width edit abstain.
//
// Switch clauses mint indentation and separators, so an inter-statement
// comment has no carrier slot. Returning uncovered leaves the entire callback
// byte-identical instead of dropping or moving that comment.
//
//  1. Put an inter-statement comment in a switch inside a callback.
//  2. Run `ttsc format`.
//  3. Require the source to survive byte-identical.
func TestCommandFormatKeepsCommentedStatementBodyWhole(t *testing.T) {
  assertFormatUnchanged(t, "run(() => {\n  switch (n) { case 1: f(); /* keep */ break; }\n});\n")
}
