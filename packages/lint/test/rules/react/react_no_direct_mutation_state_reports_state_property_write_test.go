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
func TestReactNoDirectMutationStateReportsStatePropertyWrite(t *testing.T) {
	assertReactRuleFinds(t, "react/no-direct-mutation-state", `class C { update() { this.state.count = 1; } }`, "this.state")
}
