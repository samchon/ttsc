package linthost

import "testing"

// TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileFalse verifies a `while (false)` body's escapes never execute.
//
// The loop test is the literal `false`, so the body — including its
// `break target` — is unreachable; the following `throw` then terminates the
// labeled block and the case. If the constant-false branch leaked the body's
// labeled break, the labeled block would look normally-completing and a
// false positive would appear. Locks the escape-dropping half of the
// constant-false loop branch (KindFalseKeyword folding).
//
// 1. Put a dead `break target` inside `while (false)`, followed by a throw.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when literal-false while hides a block-targeted break before an unconditional throw.
// @evidence contracts/testing.md#independent-expectations Literal false independently makes the break unreachable; collecting its syntactic presence would incorrectly reopen the block.
// @evidence contracts/testing.md#distinguishing-cases RejectsLabeledBlockBrokenByOwnLabel retains a reachable self-targeted break.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileFalse is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileFalse(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
function f(): void {
  switch (foo) {
    case 0:
      target: {
        while (false) {
          break target;
        }
        throw new Error("stop");
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "")
}
