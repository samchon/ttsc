package linthost

import "testing"

// TestDefaultCaseInvalidCommentPatternFallsBackToDefault verifies an uncompilable commentPattern degrades to the default marker.
//
// This rule retains the default marker when the custom regex cannot compile.
// The case pins that compatibility fallback; it does not establish a general
// restriction on host configuration errors or upstream error equivalence.
//
// 1. Keep the standard `// no default` marker.
// 2. Run the engine with the invalid options {"commentPattern":"("}.
// 3. Assert zero findings (default pattern still honored).
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for the default marker when the original custom regex is malformed.
// @evidence contracts/testing.md#independent-expectations The retained host compatibility contract falls back to the standard marker for an uncompilable pattern; this oracle deliberately does not claim ESLint creation-error equivalence.
// @evidence contracts/testing.md#distinguishing-cases Malformed opening-parenthesis pattern plus normal marker stays clean; valid replacement-pattern rejection is owned by CustomPatternReplacesDefaultMarker.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseInvalidCommentPatternFallsBackToDefault is selected in the shared Go unit population. It calls assertDefaultCaseClean and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseInvalidCommentPatternFallsBackToDefault(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
}
`, `{"commentPattern":"("}`)
}
