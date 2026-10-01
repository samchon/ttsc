package linthost

import "testing"

// TestDefaultCaseAcceptsBlockCommentMarker verifies a block-comment marker is honored.
//
// ESLint reads `comment.value` (delimiter-free) and trims it, so `/* no default */`
// carries the same `no default` value as the line form. Boundary twin of the
// line-comment marker covering the `/* */` delimiter stripping.
//
// 1. Place `/* no default */` as the trailing comment of the last clause.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for a trailing block-comment no-default marker.
// @evidence contracts/testing.md#independent-expectations Delimiter-free trimmed comment text independently equals no default; the comment policy does not require line-comment syntax.
// @evidence contracts/testing.md#distinguishing-cases Block-form marker stays clean; ReportsSwitchWithoutDefault owns the otherwise identical unmarked switch and RejectsMarkerWithTrailingText owns a nonmatching marker.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseAcceptsBlockCommentMarker is selected in the shared Go unit population. It calls assertDefaultCaseClean and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseAcceptsBlockCommentMarker(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  /* no default */
}
`, "")
}
