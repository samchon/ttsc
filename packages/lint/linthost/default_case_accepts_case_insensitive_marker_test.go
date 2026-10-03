package linthost

import "testing"

// TestDefaultCaseAcceptsCaseInsensitiveMarker verifies the default marker matches regardless of letter case.
//
// DEFAULT_COMMENT_PATTERN carries the `i` flag, so `// NO DEFAULT` is as valid
// as the lowercase spelling. Locks the case-insensitivity of the ported
// default pattern.
//
// 1. Place `// NO DEFAULT` as the trailing comment.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for the original uppercase NO DEFAULT trailing marker.
// @evidence contracts/testing.md#independent-expectations The default marker pattern is case-insensitive, independently allowing uppercase text without changing the missing-default clause.
// @evidence contracts/testing.md#distinguishing-cases Uppercase marker stays clean; lowercase and block marker cases own equivalent accepted forms, while unmarked and extra-text cases own reports.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseAcceptsCaseInsensitiveMarker is selected in the shared Go unit population. It calls assertDefaultCaseClean and lintDefaultCase with the authored source and empty options, using RuleConfig directly as the resolver for Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseAcceptsCaseInsensitiveMarker(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // NO DEFAULT
}
`, "")
}
