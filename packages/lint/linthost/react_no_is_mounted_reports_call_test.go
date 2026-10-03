package linthost

import "testing"

// TestReactNoIsMountedReportsCall verifies isMounted calls are rejected.
//
// `isMounted` is a legacy escape hatch and can be caught from the call name.
//
// 1. Parse a this.isMounted call.
// 2. Enable only `react/no-is-mounted`.
// 3. Assert the call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify this.isMounted reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations An ordinary application method does not invoke the deprecated mounted-state API.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoIsMountedReportsCall is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoIsMountedReportsCall(t *testing.T) {
  assertReactRuleFinds(t, "react/no-is-mounted", `class C { check() { return this.isMounted(); } }`, "isMounted")
  assertReactRuleSkips(t, "react/no-is-mounted", "class C { check() { return this.ready(); } }")
}
