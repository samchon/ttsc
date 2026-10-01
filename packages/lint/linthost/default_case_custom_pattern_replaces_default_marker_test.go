package linthost

import "testing"

// TestDefaultCaseCustomPatternReplacesDefaultMarker verifies a custom commentPattern disables the default marker.
//
// ESLint compiles the custom pattern INSTEAD of the default one, so the
// standard `// no default` stops being accepted once a project configures its
// own wording (upstream invalid regression). Negative twin of the
// custom-pattern acceptance, one property away (the comment kept at the
// default spelling).
//
// 1. Keep the default `// no default` marker under a custom pattern.
// 2. Run the engine with options {"commentPattern":"^skip default$"}.
// 3. Assert exactly one finding at the switch statement (line 2).
//
// @evidence contracts/testing.md#behavioral-verification Engine requires exactly one error at switch line two when a custom pattern replaces the original default marker pattern.
// @evidence contracts/testing.md#independent-expectations The authored ^skip default$ option independently excludes no default; custom policy replaces rather than extends the standard marker.
// @evidence contracts/testing.md#distinguishing-cases Standard marker reports under custom wording; HonorsCustomCommentPattern owns the matching custom-marker clean twin.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseCustomPatternReplacesDefaultMarker is selected in the shared Go unit population. It calls assertDefaultCaseReportsAtLines and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseCustomPatternReplacesDefaultMarker(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
}
`, `{"commentPattern":"^skip default$"}`, 2)
}
