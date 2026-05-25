package linthost

import "testing"

// TestReactStylePropObjectReportsStringStyle verifies style strings are
// rejected.
//
// React's `style` prop expects an object; string literals are always the wrong
// shape.
//
// 1. Parse a JSX element with a string style prop.
// 2. Enable only `react/style-prop-object`.
// 3. Assert the style prop is reported.
func TestReactStylePropObjectReportsStringStyle(t *testing.T) {
	assertReactRuleFinds(t, "react/style-prop-object", `const C = () => <div style="color: red" />;`, "Style")
}
