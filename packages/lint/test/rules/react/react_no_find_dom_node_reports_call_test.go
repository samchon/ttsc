package linthost

import "testing"

// TestReactNoFindDOMNodeReportsCall verifies findDOMNode calls are rejected.
//
// The call shape is explicit and deprecated in modern React.
//
// 1. Parse a ReactDOM.findDOMNode call.
// 2. Enable only `react/no-find-dom-node`.
// 3. Assert the call is reported.
func TestReactNoFindDOMNodeReportsCall(t *testing.T) {
	assertReactRuleFinds(t, "react/no-find-dom-node", `ReactDOM.findDOMNode(this);`, "findDOMNode")
}
