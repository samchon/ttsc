package linthost

import "testing"

// TestReactNoArrayIndexKeySkipsNestedNonListElement verifies nested JSX is not
// treated as the mapped item.
//
// A child element inside the returned list item may receive its own stable key
// for a separate reason. The rule should follow the same list-item boundary as
// `react/jsx-key`.
//
// 1. Parse a map callback returning a keyed wrapper with a nested keyed child.
// 2. Enable only `react/no-array-index-key`.
// 3. Assert the nested `key={index}` is not reported.
func TestReactNoArrayIndexKeySkipsNestedNonListElement(t *testing.T) {
	assertReactRuleSkips(t, "react/no-array-index-key", `const C = ({ items }: { items: string[] }) => items.map((item, index) => <li key={item}><span key={index}>{item}</span></li>);`)
}
