package linthost

import "testing"

// TestReactJSXKeyReportsArrayElement verifies JSX array elements need keys.
//
// Array literals are the simplest list rendering shape and avoid needing any
// dataflow or component inference.
//
// 1. Parse a JSX array literal.
// 2. Enable only `react/jsx-key`.
// 3. Assert the unkeyed list element is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify unkeyed JSX array item reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations React list reconciliation requires the item key.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXKeyReportsArrayElement is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXKeyReportsArrayElement(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-key", `const nodes = [<li />];`, "key")
  assertReactRuleSkips(t, "react/jsx-key", "const nodes = [<li key=\"one\" />];")
}
