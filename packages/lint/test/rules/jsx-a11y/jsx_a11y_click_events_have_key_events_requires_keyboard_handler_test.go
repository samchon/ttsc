package linthost

import "testing"

// TestJsxA11yClickEventsHaveKeyEventsRequiresKeyboardHandler verifies click handlers need keyboard parity.
//
// The rule intentionally skips native interactive elements, so a plain div with
// only onClick exercises the static non-interactive branch.
//
// 1. Parse a div with onClick and no keyboard handler.
// 2. Enable only `jsx-a11y/click-events-have-key-events`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yClickEventsHaveKeyEventsRequiresKeyboardHandler(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/click-events-have-key-events", `const Component = () => <div onClick={() => {}} />;`, "keyboard")
}
