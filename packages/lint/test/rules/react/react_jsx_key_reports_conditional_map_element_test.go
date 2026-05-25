package linthost

import "testing"

// TestReactJSXKeyReportsConditionalMapElement verifies conditional list
// branches need keys.
//
// Map callbacks often return ternaries instead of a JSX element directly. The
// rule must still treat each JSX branch as the list item while not walking into
// nested JSX children.
//
// 1. Parse a map callback returning a ternary with JSX branches.
// 2. Enable only `react/jsx-key`.
// 3. Assert the unkeyed branch element is reported.
func TestReactJSXKeyReportsConditionalMapElement(t *testing.T) {
	assertReactRuleFinds(t, "react/jsx-key", `const C = ({ items }: { items: string[] }) => items.map((item) => item ? <li key={item}>{item}</li> : <span>{item}</span>);`, "key")
}
