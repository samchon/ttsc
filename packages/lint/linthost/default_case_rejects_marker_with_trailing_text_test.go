package linthost

import "testing"

// TestDefaultCaseRejectsMarkerWithTrailingText verifies the anchored default pattern rejects extra words.
//
// DEFAULT_COMMENT_PATTERN is anchored (`^no default$`), so `// no default here`
// does not match and the omission stays unmarked. Boundary twin locking the
// anchors against a loose substring match.
//
// 1. Place `// no default here` as the trailing comment.
// 2. Run the engine with default-case enabled.
// 3. Assert exactly one finding at the switch statement (line 2).
//
// @evidence contracts/testing.md#behavioral-verification Engine requires exactly one error at switch line two for no default here.
// @evidence contracts/testing.md#independent-expectations The default marker pattern is anchored, independently rejecting extra text rather than accepting a substring.
// @evidence contracts/testing.md#distinguishing-cases Extra-word marker reports; AcceptsNoDefaultMarker owns the exact-text clean twin.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseRejectsMarkerWithTrailingText is selected in the shared Go unit population. It calls assertDefaultCaseReportsAtLines and lintDefaultCase with the authored extra-word marker and empty options, using RuleConfig directly as the resolver for Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseRejectsMarkerWithTrailingText(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default here
}
`, "", 2)
}
