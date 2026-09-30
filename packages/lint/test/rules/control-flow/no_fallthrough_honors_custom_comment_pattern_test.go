package linthost

import "testing"

// TestNoFallthroughHonorsCustomCommentPattern verifies the commentPattern option accepts a matching custom marker.
//
// Upstream valid case with `commentPattern: "break omitted"`: a project can
// standardize its own marker wording, delivered through the typed rule
// options transport. Locks the custom-pattern compilation and matching path.
//
// 1. Mark the transition with `/* break omitted */`.
// 2. Run the engine with options {"commentPattern":"break omitted"}.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification No finding reports for the original break-omitted comment matching its configured pattern.
// @evidence contracts/testing.md#independent-expectations Literal comment text and authored commentPattern define the acceptance oracle independently of the default spelling.
// @evidence contracts/testing.md#distinguishing-cases CustomPatternReplacesDefaultMarker keeps the default text under the custom pattern and reports.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughHonorsCustomCommentPattern is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughHonorsCustomCommentPattern(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    /* break omitted */
  case 1:
    console.log(1);
    break;
}
`, `{"commentPattern":"break omitted"}`)
}
