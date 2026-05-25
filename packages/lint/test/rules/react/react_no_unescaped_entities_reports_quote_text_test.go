package linthost

import "testing"

// TestReactNoUnescapedEntitiesReportsQuoteText verifies unescaped JSX text.
//
// The rule flags raw quote-like characters in text nodes without inspecting
// expressions or generated strings.
//
// 1. Parse JSX text containing an apostrophe.
// 2. Enable only `react/no-unescaped-entities`.
// 3. Assert the text node is reported.
func TestReactNoUnescapedEntitiesReportsQuoteText(t *testing.T) {
	assertReactRuleFinds(t, "react/no-unescaped-entities", `const C = () => <div>Tom's profile</div>;`, "Unescaped")
}
