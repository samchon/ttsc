package linthost

import "testing"

// TestJsxA11yInteractiveSupportsFocusRequiresTabindex verifies interactive roles need focus.
//
// A custom element with role button must be reachable by keyboard. This case
// locks the explicit-role path separate from native button handling.
//
// 1. Parse a div with role button and no tabIndex.
// 2. Enable only `jsx-a11y/interactive-supports-focus`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yInteractiveSupportsFocusRequiresTabindex(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/interactive-supports-focus", `const Component = () => <div role="button" />;`, "focusable")
}
