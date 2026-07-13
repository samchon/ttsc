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
