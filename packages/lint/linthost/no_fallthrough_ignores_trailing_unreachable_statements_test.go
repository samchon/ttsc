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
//
// @evidence contracts/testing.md#behavioral-verification No finding reports after an unconditional return followed by dead logging.
// @evidence contracts/testing.md#independent-expectations The authored return closes normal case completion before the subsequent statement; scanning the final textual statement alone would be wrong.
// @evidence contracts/testing.md#distinguishing-cases Open-branch rejection cases retain reachable logging that genuinely permits a next-case transition.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughIgnoresTrailingUnreachableStatements is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
