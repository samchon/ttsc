package linthost

import "testing"

// TestDefaultCaseRequiresMarkerToBeLastComment verifies only the last trailing comment counts as the marker.
//
// ESLint tests getCommentsAfter(lastCase).at(-1): when an unrelated comment
// follows the marker, the marker no longer speaks for the switch. Locks the
// last-comment-only selection against an "any comment in range matches"
// over-match.
//
// 1. Place `// no default` followed by `// revisit later` after the last clause.
// 2. Run the engine with default-case enabled.
// 3. Assert exactly one finding at the switch statement (line 2).
//
// @evidence contracts/testing.md#behavioral-verification Engine requires exactly one error at switch line two when an unrelated comment follows the marker.
// @evidence contracts/testing.md#independent-expectations The supported last-trailing-comment policy independently gives revisit later ownership of the omission; an earlier matching comment cannot suppress it.
// @evidence contracts/testing.md#distinguishing-cases Matching marker followed by unrelated text reports; AcceptsNoDefaultMarker owns the marker-last clean twin.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseRequiresMarkerToBeLastComment is selected in the shared Go unit population. It calls assertDefaultCaseReportsAtLines and lintDefaultCase with the authored marker followed by an unrelated comment and empty options, using RuleConfig directly as the resolver for Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseRequiresMarkerToBeLastComment(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
  // revisit later
}
`, "", 2)
}
