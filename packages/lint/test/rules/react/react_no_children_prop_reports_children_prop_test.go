package linthost

import "testing"

// TestReactNoChildrenPropReportsChildrenProp verifies children are nested.
//
// Passing `children` as a normal prop fights JSX's primary child syntax and is
// a direct AST-level smell.
//
// 1. Parse a JSX element with a children prop.
// 2. Enable only `react/no-children-prop`.
// 3. Assert the prop is reported.
func TestReactNoChildrenPropReportsChildrenProp(t *testing.T) {
	assertReactRuleFinds(t, "react/no-children-prop", `const C = () => <div children="text" />;`, "children")
}
