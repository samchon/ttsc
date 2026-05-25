package linthost

import "testing"

// TestReactJSXKeyReportsLogicalMapElement verifies logical list branches need
// keys.
//
// Conditional rendering with `&&` is a common map callback shape. The rule
// should report the JSX branch because React still receives it as the mapped
// item when the condition is true.
//
// 1. Parse a map callback returning `condition && <li />`.
// 2. Enable only `react/jsx-key`.
// 3. Assert the unkeyed logical branch element is reported.
func TestReactJSXKeyReportsLogicalMapElement(t *testing.T) {
	assertReactRuleFinds(t, "react/jsx-key", `const C = ({ items }: { items: string[] }) => items.map((item) => item && <li>{item}</li>);`, "key")
}
