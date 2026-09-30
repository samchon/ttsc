package linthost

import "testing"

// TestNoFallthroughUnusedCommentIgnoredByDefault verifies unused markers stay silent without the option.
//
// reportUnusedFallthroughComment defaults to false upstream, so the exact
// source that reports with the option enabled must produce nothing under the
// scalar default configuration. Negative twin of the unused-comment report,
// one property away (the option removed).
//
// 1. Put a marker between a breaking case and the next label.
// 2. Run the engine with no options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings report for a marker after break under scalar defaults.
// @evidence contracts/testing.md#independent-expectations The independently absent reportUnusedFallthroughComment option leaves unused markers silent rather than changing reachability.
// @evidence contracts/testing.md#distinguishing-cases ReportsUnusedFallthroughComment enables the option for the same original break and marker shape.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughUnusedCommentIgnoredByDefault is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughUnusedCommentIgnoredByDefault(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  /* falls through */
  case 1:
    console.log(1);
}
`, "")
}
