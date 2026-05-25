package linthost

import "testing"

// TestReactButtonHasTypeRequiresExplicitType verifies React button elements
// declare a safe type.
//
// Buttons default to submit in forms, so missing or invalid type attributes are
// a high-confidence TSX issue that does not need React runtime analysis.
//
// 1. Parse a JSX button without a type prop.
// 2. Enable only `react/button-has-type`.
// 3. Assert one diagnostic is reported.
func TestReactButtonHasTypeRequiresExplicitType(t *testing.T) {
	assertReactRuleFinds(t, "react/button-has-type", `const C = () => <button>Save</button>;`, "button")
}
