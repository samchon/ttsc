package linthost

import "testing"

// TestNoFallthroughIgnoresTrailingUnreachableStatements verifies dead code after a return does not reopen the case.
//
// Upstream valid case `case 1: return a; a++;`: the statements after the
// return are unreachable, so the case end stays unreachable regardless of
// what they are. Locks the reachability cutoff in statementListCompletion.
//
// 1. Follow a `return` with an ordinary statement inside the case.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughIgnoresTrailingUnreachableStatements(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
function f(): number {
  switch (foo) {
    case 0:
      return 1;
      console.log("dead");
    case 1:
      return 2;
  }
  return 0;
}
JSON.stringify(f);
`, "")
}
