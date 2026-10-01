package linthost

import "testing"

// TestFormatReflowPreservesNestedCallArgComment verifies comment preservation
// inside the argument gap of an inner call during outer-call reflow.
//
// Guarding only the outer call cannot protect trivia owned by a nested call.
// The comment-free twin requires ordinary outer-call reflow to remain active.
//
// 1. Format the original nested argument comment and require unchanged bytes.
// 2. Remove that comment and require the expected broken outer call.
//
// @evidence contracts/testing.md#behavioral-verification The in-process format command must preserve the nested call argument comment and all original source bytes. A comment-free twin must break the outer call, detecting either deleting the inner comment or disabling all call reflow. The owned result is: Remove that comment and require the expected broken outer call. .
// @evidence contracts/testing.md#independent-expectations The literal original comment must survive; installed Prettier 3.8.3 independently supplies the comment-free outer-call layout. Literal argument order and call names are retained in both oracles.
// @evidence contracts/testing.md#distinguishing-cases The comment is inside the inner call argument gap, where guarding only the outer call is insufficient. The twin removes that comment while retaining the long outer callee and both inner arguments, giving an adjacent positive.
// @evidence contracts/testing.md#execution-ownership TestFormatReflowPreservesNestedCallArgComment owns its two authored call fixtures and complete outputs. The helper invokes Go run directly in the same process with temporary project files and captured streams; no consumer install, native build or CLI child executes.
func TestFormatReflowPreservesNestedCallArgComment(t *testing.T) {
  assertFormatUnchanged(t, `const result = outerFunctionWithAQuiteLongName(innerCallHelper(alphaArgument, /* keep */ betaArgument));
`)
  assertFormatResult(t,
    "const result = outerFunctionWithAQuiteLongName(innerCallHelper(alphaArgument, betaArgument));\n",
    "const result = outerFunctionWithAQuiteLongName(\n  innerCallHelper(alphaArgument, betaArgument),\n);\n")
}
