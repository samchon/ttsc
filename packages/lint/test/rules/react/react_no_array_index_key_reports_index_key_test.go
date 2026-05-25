package linthost

import "testing"

// TestReactNoArrayIndexKeyReportsIndexKey verifies index keys are rejected.
//
// `key={index}` is a known reconciliation footgun and can be caught from the
// JSX attribute expression alone.
//
// 1. Parse a JSX element with key={index}.
// 2. Enable only `react/no-array-index-key`.
// 3. Assert the key prop is reported.
func TestReactNoArrayIndexKeyReportsIndexKey(t *testing.T) {
	assertReactRuleFinds(t, "react/no-array-index-key", `const C = ({ items }: { items: string[] }) => items.map((item, index) => <li key={index}>{item}</li>);`, "index")
}
