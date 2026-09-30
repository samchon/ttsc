package linthost

import "testing"

// TestFormatReflowPreservesNewConstructeeGapComment verifies preservation of
// a comment between new and its constructee when the argument list is absent.
//
// Reprinting this nested allocation must retain keyword-gap trivia even when
// there is no argument list to trigger an argument-gap guard.
//
// 1. Seed an outer call with an array containing the comment-bearing allocation.
// 2. Format it directly and require every original byte to survive.
//
// @evidence contracts/testing.md#behavioral-verification The in-process format command must preserve the comment between new and its no-argument constructee, including the original outer call and array. Full unchanged output catches dropping that gap while printing a nested allocation. The owned result is: Format it directly and require every original byte to survive. .
// @evidence contracts/testing.md#independent-expectations The authored allocation comment and program bytes must survive. The source itself is the independent byte-preservation oracle, not an expected result obtained from printer coverage or AST traversal.
// @evidence contracts/testing.md#distinguishing-cases This no-argument new expression distinguishes the keyword gap from argument-list comments. NestedCallArgComment and ReturnComment cover other recursive gaps; existing printer new-expression cases exercise ordinary comment-free allocation rendering.
// @evidence contracts/testing.md#execution-ownership TestFormatReflowPreservesNewConstructeeGapComment owns its allocation/array/call fixture and unchanged output. Its helper directly calls Go run in the same process with temporary project files and captured streams, without building native artifacts, installing a consumer or starting a CLI child.
func TestFormatReflowPreservesNewConstructeeGapComment(t *testing.T) {
  assertFormatUnchanged(t, `const result = wrapWithAnEvenLongerFunctionNameToForceReflow([new /* keep */ AllocatorInstance]);
`)
}
