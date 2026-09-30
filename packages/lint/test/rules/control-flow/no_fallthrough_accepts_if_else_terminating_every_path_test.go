package linthost

import "testing"

// TestNoFallthroughAcceptsIfElseTerminatingEveryPath verifies an if/else whose every branch exits terminates the case.
//
// This is the second false positive from issue #411: `if (c) { return; }
// else { throw ...; }` leaves no reachable path into the next case, so no
// break is needed. Locks the branch-join rule of the completion analysis
// (normal completion requires at least one normally-completing branch).
//
// 1. End a case with an if/else where one branch returns and the other throws.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for return and throw branches of an exhaustive if-else.
// @evidence contracts/testing.md#independent-expectations Each hand-authored branch has an abrupt completion, so no ordinary branch can reach the next label.
// @evidence contracts/testing.md#distinguishing-cases RejectsIfElseWithOneOpenBranch and RejectsIfWithoutElse retain independently open branch twins.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsIfElseTerminatingEveryPath is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsIfElseTerminatingEveryPath(t *testing.T) {
  assertNoFallthroughClean(t, `declare const mode: 1 | 2;
declare const condition: boolean;

function stopEveryPath(): void {
  switch (mode) {
    case 1:
      if (condition) {
        return;
      } else {
        throw new Error("stop");
      }
    case 2:
      return;
  }
}
JSON.stringify(stopEveryPath);
`, "")
}
