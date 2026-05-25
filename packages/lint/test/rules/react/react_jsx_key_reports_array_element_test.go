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
func TestReactJSXKeyReportsArrayElement(t *testing.T) {
	assertReactRuleFinds(t, "react/jsx-key", `const nodes = [<li />];`, "key")
}
