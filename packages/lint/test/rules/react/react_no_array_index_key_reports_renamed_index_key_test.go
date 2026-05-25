package linthost

import "testing"

// TestReactNoArrayIndexKeyReportsRenamedIndexKey verifies renamed index
// parameters are rejected.
//
// Teams often name the second map callback parameter `idx` or `i`; the rule
// should follow the actual parameter binding instead of only the literal word
// `index`.
//
// 1. Parse a map callback with `idx` as the second parameter.
// 2. Enable only `react/no-array-index-key`.
// 3. Assert `key={idx}` is reported.
func TestReactNoArrayIndexKeyReportsRenamedIndexKey(t *testing.T) {
	assertReactRuleFinds(t, "react/no-array-index-key", `const C = ({ items }: { items: string[] }) => items.map((item, idx) => <li key={idx}>{item}</li>);`, "index")
}
