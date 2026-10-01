package linthost

import "testing"

// TestFormatReflowPreservesReturnComment verifies the full formatter preserves
// a comment between return and its argument inside a callback block.
//
// Reprinting a nested statement must not discard its leading expression trivia.
// Exact source preservation catches losing the comment or moving surrounding
// callback bytes, without depending on an internal coverage-flag value.
//
// 1. Seed a callback whose long return expression follows a block comment.
// 2. Invoke the format command directly and require byte-identical output.
//
// @evidence contracts/testing.md#behavioral-verification The in-process format command must preserve the complete callback source, including the comment between return and its expression. Exact disk output detects deleting return-gap trivia during nested reprinting. The owned result is: Invoke the format command directly and require byte-identical output. .
// @evidence contracts/testing.md#independent-expectations The authored comment and program tokens must survive formatting. The complete unchanged source is a byte-preservation oracle independent of the printer coverage flags, and does not claim the source is universally Prettier-canonical.
// @evidence contracts/testing.md#distinguishing-cases This comment sits in a nested return expression rather than between top-level callback arguments. NestedCallArgComment and TernaryParenComment distinguish other recursive trivia boundaries; the existing printer return cases exercise ordinary comment-free rendering.
// @evidence contracts/testing.md#execution-ownership TestFormatReflowPreservesReturnComment owns the callback fixture and its complete unchanged output. Its helper directly invokes Go run in the same process and observes temporary fixture files and captured streams; no CLI child, consumer install or native build is started.
func TestFormatReflowPreservesReturnComment(t *testing.T) {
  assertFormatUnchanged(t, `const wrapped = makeWrapperWithAName(() => {
  return /* keep */ someObjectValueWithAQuiteLongNameThatOverflowsThePrintWidth;
});
`)
}
