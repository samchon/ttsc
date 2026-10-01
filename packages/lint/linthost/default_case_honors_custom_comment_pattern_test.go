package linthost

import "testing"

// TestDefaultCaseHonorsCustomCommentPattern verifies the commentPattern option accepts a matching custom marker.
//
// Upstream compiles `new RegExp(options.commentPattern, "u")`, letting a
// project standardize its own marker wording, delivered through the typed rule
// options transport. Locks the custom-pattern compilation and matching path.
//
// 1. Mark the omission with `// skip default`.
// 2. Run the engine with options {"commentPattern":"^skip default$"}.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for the matching skip-default marker under the authored custom pattern.
// @evidence contracts/testing.md#independent-expectations Literal ^skip default$ and the authored comment match independently of the regexp produced by the implementation.
// @evidence contracts/testing.md#distinguishing-cases Custom matching marker stays clean; CustomPatternReplacesDefaultMarker owns the wrong default-spelling report under the same option.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseHonorsCustomCommentPattern is selected in the shared Go unit population. It calls assertDefaultCaseClean and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseHonorsCustomCommentPattern(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // skip default
}
`, `{"commentPattern":"^skip default$"}`)
}
