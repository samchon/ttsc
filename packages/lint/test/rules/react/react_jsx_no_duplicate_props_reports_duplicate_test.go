package linthost

import "testing"

// TestReactJSXNoDuplicatePropsReportsDuplicate verifies duplicate JSX props.
//
// Duplicate prop names are resolved by later props at runtime and are almost
// always accidental.
//
// 1. Parse a JSX element with the same prop twice.
// 2. Enable only `react/jsx-no-duplicate-props`.
// 3. Assert the second prop is reported.
func TestReactJSXNoDuplicatePropsReportsDuplicate(t *testing.T) {
	assertReactRuleFinds(t, "react/jsx-no-duplicate-props", `const C = () => <div className="a" className="b" />;`, "duplicate")
}
