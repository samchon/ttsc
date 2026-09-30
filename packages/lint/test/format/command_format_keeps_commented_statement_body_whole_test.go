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
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises keeps commented statement body whole and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Require the source to survive byte-identical.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Put an inter-statement comment in a switch inside a callback. The asserted decision is: Require the source to survive byte-identical. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatKeepsCommentedStatementBodyWhole owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatKeepsCommentedStatementBodyWhole(t *testing.T) {
  assertFormatUnchanged(t, "run(() => {\n  switch (n) { case 1: f(); /* keep */ break; }\n});\n")
}
