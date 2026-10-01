package linthost

import "testing"

// TestDefaultCaseAcceptsNoDefaultMarker verifies the // no default marker suppresses the finding.
//
// ESLint accepts a trailing comment whose trimmed text matches
// DEFAULT_COMMENT_PATTERN (`/^no default$/iu`) as an explicit statement that
// the omitted default is intentional. Locks the marker-scan path the pre-fix
// port never implemented despite its header claim.
//
// 1. Place `// no default` as the last comment before the case block's `}`.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for the original lowercase trailing no-default marker.
// @evidence contracts/testing.md#independent-expectations The exact trimmed no default comment independently matches the supported default exemption pattern.
// @evidence contracts/testing.md#distinguishing-cases Exact last marker stays clean; trailing-text, unrelated-comment and last-comment-order cases own the nearest reportable variants.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseAcceptsNoDefaultMarker is selected in the shared Go unit population. It calls assertDefaultCaseClean and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseAcceptsNoDefaultMarker(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
}
`, "")
}
