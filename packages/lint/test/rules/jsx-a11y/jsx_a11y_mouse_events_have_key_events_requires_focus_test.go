package linthost

import "testing"

// TestJsxA11yMouseEventsHaveKeyEventsRequiresFocus verifies mouseover has focus parity.
//
// Hover-only behavior excludes keyboard users. This case locks the sibling
// handler check for onMouseOver and onFocus.
//
// 1. Parse a div with onMouseOver and no onFocus.
// 2. Enable only `jsx-a11y/mouse-events-have-key-events`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yMouseEventsHaveKeyEventsRequiresFocus(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/mouse-events-have-key-events", `const Component = () => <div onMouseOver={() => {}} />;`, "onFocus")
}
