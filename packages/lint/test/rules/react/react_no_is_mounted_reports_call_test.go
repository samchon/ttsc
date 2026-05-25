package linthost

import "testing"

// TestReactNoIsMountedReportsCall verifies isMounted calls are rejected.
//
// `isMounted` is a legacy escape hatch and can be caught from the call name.
//
// 1. Parse a this.isMounted call.
// 2. Enable only `react/no-is-mounted`.
// 3. Assert the call is reported.
func TestReactNoIsMountedReportsCall(t *testing.T) {
	assertReactRuleFinds(t, "react/no-is-mounted", `class C { check() { return this.isMounted(); } }`, "isMounted")
}
