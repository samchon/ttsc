package linthost

import "testing"

// TestNoFallthroughReportsUnusedCommentAfterTerminatingIfElse verifies the unused check keys on case-end reachability, not on breaks alone.
//
// Upstream invalid case: an if/else-if chain where every branch throws,
// breaks, or returns leaves the case end unreachable — the marker above the
// next case is unused even though no bare `break` ends the case. Locks the
// !endReachable condition of the unused branch against a shallower
// "ends-with-break" heuristic.
//
// 1. Terminate a case through an exhaustive if/else-if chain, then add a marker.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert one finding at the marker's line.
//
// @evidence contracts/testing.md#behavioral-verification One no-fallthrough error reports on original marker line fourteen after an exhaustive abrupt branch chain.
// @evidence contracts/testing.md#independent-expectations Authored throw, break and return branches each close case completion, making the otherwise eligible marker unused under its enabled option.
// @evidence contracts/testing.md#distinguishing-cases UnusedCheckAcceptsRealFallthroughMarker retains an actually open marked case.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughReportsUnusedCommentAfterTerminatingIfElse is selected in the shared Go unit population and invokes lintNoFallthrough through the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughReportsUnusedCommentAfterTerminatingIfElse(t *testing.T) {
  file, findings := lintNoFallthrough(t, `declare const foo: number;
declare const a: boolean;
declare const b: boolean;
function f(): void {
  switch (foo) {
    case 1:
      if (a) {
        throw new Error("a");
      } else if (b) {
        break;
      } else {
        return;
      }
    // falls through
    case 2:
      break;
  }
}
JSON.stringify(f);
`, `{"reportUnusedFallthroughComment":true}`)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != 1 || actual[0].Rule != "no-fallthrough" || actual[0].Severity != SeverityError || actual[0].Line != 14 {
    t.Fatalf("expected one finding at line 14, got %+v", actual)
  }
}
