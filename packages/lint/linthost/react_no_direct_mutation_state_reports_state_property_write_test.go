package linthost

import "testing"

// TestReactNoDirectMutationStateReportsStatePropertyWrite verifies direct state
// mutation is rejected.
//
// Mutating `this.state` bypasses React's update queue; the constructor
// initializer exception does not apply to nested property writes.
//
// 1. Parse a class method assigning to this.state.count.
// 2. Enable only `react/no-direct-mutation-state`.
// 3. Assert the assignment target is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify this.state.count assignment reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations setState owns state updates instead of direct writes.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoDirectMutationStateReportsStatePropertyWrite is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoDirectMutationStateReportsStatePropertyWrite(t *testing.T) {
  assertReactRuleFinds(t, "react/no-direct-mutation-state", `class C { update() { this.state.count = 1; } }`, "this.state")
  assertReactRuleSkips(t, "react/no-direct-mutation-state", "class C { update() { this.setState({ count: 1 }); } }")
}
