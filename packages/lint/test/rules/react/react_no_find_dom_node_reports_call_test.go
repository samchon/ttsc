package linthost

import "testing"

// TestReactNoFindDOMNodeReportsCall verifies findDOMNode calls are rejected.
//
// The call shape is explicit and deprecated in modern React.
//
// 1. Parse a ReactDOM.findDOMNode call.
// 2. Enable only `react/no-find-dom-node`.
// 3. Assert the call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify ReactDOM.findDOMNode reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations The forbidden legacy lookup differs from ordinary component rendering.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoFindDOMNodeReportsCall is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoFindDOMNodeReportsCall(t *testing.T) {
  assertReactRuleFinds(t, "react/no-find-dom-node", `ReactDOM.findDOMNode(this);`, "findDOMNode")
  assertReactRuleSkips(t, "react/no-find-dom-node", "ReactDOM.render(view, root);")
}
