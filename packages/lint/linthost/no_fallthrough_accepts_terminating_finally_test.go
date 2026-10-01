package linthost

import "testing"

// TestNoFallthroughAcceptsTerminatingFinally verifies a finally block that breaks terminates the case.
//
// Upstream valid case `try {} finally { break; }`: the finally block runs on
// every path, so its abrupt completion makes the case end unreachable no
// matter what the try block does. Locks the finally-completion-wins rule of
// tryCompletion.
//
// 1. End a case with a try whose finally block breaks.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when an unconditional finally break terminates the case.
// @evidence contracts/testing.md#independent-expectations The authored finalizer executes on each supported path and its abrupt completion overrides normal try completion.
// @evidence contracts/testing.md#distinguishing-cases RejectsOpenTryWithNormalFinally removes the break and reports.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsTerminatingFinally is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsTerminatingFinally(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    try {
      console.log(0);
    } finally {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
