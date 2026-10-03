package linthost

import "testing"

// TestNoFallthroughAcceptsMarkedEmptyCaseWithBlankGap verifies a marker rescues an empty case that has a blank-line gap.
//
// The blank-line heuristic flags the empty case as a fallthrough, but the
// marker check still runs on the trailing region (which starts right after
// the case colon), so `// falls through` suppresses the report. Locks that
// empty cases get the same marker treatment as populated ones.
//
// 1. Mark an empty case whose next label sits below a blank line.
// 2. Run the engine with no-fallthrough enabled and default options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for an empty label with a blank gap and a falls-through marker.
// @evidence contracts/testing.md#independent-expectations The authored eligible marker explicitly permits the transition despite the ordinary blank-gap warning.
// @evidence contracts/testing.md#distinguishing-cases RejectsEmptyCaseFollowedByBlankLine preserves the same gap without a marker.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsMarkedEmptyCaseWithBlankGap is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsMarkedEmptyCaseWithBlankGap(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0: // falls through

  case 1:
    console.log(1);
    break;
}
`, "")
}
