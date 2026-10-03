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
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a callback containing a one-line `switch` whose clause has an inter-statement comment (`f(); /* keep */ break;`) and requires the whole file byte-identical, so the comment is neither dropped nor moved.
// @evidence contracts/testing.md#independent-expectations The source is an authored literal that serves as its own expected output; the property that comment-bearing bodies are left whole comes from the print-width abstention contract, not from formatter output.
// @evidence contracts/testing.md#distinguishing-cases One abstention case; the uncommented twin that would be expanded is not asserted in this test, so only the unchanged outcome with the comment present is checked.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatKeepsCommentedStatementBodyWhole(t *testing.T) {
  assertFormatUnchanged(t, "run(() => {\n  switch (n) { case 1: f(); /* keep */ break; }\n});\n")
}
