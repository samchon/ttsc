package linthost

import "testing"

// TestNoFallthroughRejectsUnrelatedTrailingComment verifies no-fallthrough still reports when the trailing comment is not a marker.
//
// Negative twin of the marked-fallthrough acceptance: a comment sits in the
// eligible trailing position but does not match the marker pattern, so the
// transition must report. Locks against "any comment suppresses" over-matching.
//
// 1. Build a fallthrough whose trailing comment reads `// keep going`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line six for keep-going wording.
// @evidence contracts/testing.md#independent-expectations The authored trailing comment occupies the eligible position but fails the marker pattern, distinguishing content from comment presence.
// @evidence contracts/testing.md#distinguishing-cases AcceptsMarkedFallthroughVariants owns the accepted spelling/case variants.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsUnrelatedTrailingComment is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsUnrelatedTrailingComment(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // keep going
  case 1:
    console.log(1);
    break;
}
`, "", 6)
}
