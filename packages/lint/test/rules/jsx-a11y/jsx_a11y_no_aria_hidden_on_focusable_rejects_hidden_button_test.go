package linthost

import "testing"

// TestJsxA11yNoAriaHiddenOnFocusableRejectsHiddenButton verifies focusable nodes are not aria-hidden.
//
// A focused control hidden from the accessibility tree is contradictory. This
// case covers native focusability without requiring tabIndex.
//
// 1. Parse a button with aria-hidden true.
// 2. Enable only `jsx-a11y/no-aria-hidden-on-focusable`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoAriaHiddenOnFocusableRejectsHiddenButton(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-aria-hidden-on-focusable", `const Component = () => <button aria-hidden="true">Save</button>;`, "aria-hidden")
}
