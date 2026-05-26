package linthost

import "testing"

// TestJsxA11yTabindexNoPositiveRejectsPositiveTabindex verifies positive tabIndex is rejected.
//
// Positive tabIndex creates a custom focus order. This test covers numeric JSX
// expression extraction for camel-case `tabIndex`.
//
// 1. Parse a div with tabIndex 2.
// 2. Enable only `jsx-a11y/tabindex-no-positive`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yTabindexNoPositiveRejectsPositiveTabindex(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/tabindex-no-positive", `const Component = () => <div tabIndex={2} />;`, "tabIndex")
}
