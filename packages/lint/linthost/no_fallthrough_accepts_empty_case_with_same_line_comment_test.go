package linthost

import "testing"

// TestNoFallthroughAcceptsEmptyCaseWithSameLineComment verifies a comment without a blank-line gap keeps an empty case silent.
//
// Upstream valid case `case 0: // comment\ncase 1: break;`: the next label
// starts on the very next line, so there is no blank-line gap and the empty
// case stays exempt — no marker needed. Locks that the blank-line check
// measures token lines, not the presence of comments.
//
// 1. Put an unrelated comment on the empty case's own line, next label directly below.
// 2. Run the engine with no-fallthrough enabled and default options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for an empty label with an unrelated comment on its own label line.
// @evidence contracts/testing.md#independent-expectations The next label is directly adjacent by token line; comment presence alone does not create the supported blank-gap warning.
// @evidence contracts/testing.md#distinguishing-cases RejectsEmptyCaseWithCommentLineGap moves unrelated trivia onto a separate line and reports.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsEmptyCaseWithSameLineComment is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsEmptyCaseWithSameLineComment(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0: // comment
  case 1:
    console.log(1);
    break;
}
`, "")
}
