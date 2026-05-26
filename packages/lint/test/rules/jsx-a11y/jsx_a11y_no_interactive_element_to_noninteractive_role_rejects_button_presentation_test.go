package linthost

import "testing"

// TestJsxA11yNoInteractiveElementToNoninteractiveRoleRejectsButtonPresentation verifies role downgrades are rejected.
//
// Native controls should keep their interactive semantics. This case covers the
// implicit-role branch for a button with a non-interactive explicit role.
//
// 1. Parse a button with role presentation.
// 2. Enable only `jsx-a11y/no-interactive-element-to-noninteractive-role`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoInteractiveElementToNoninteractiveRoleRejectsButtonPresentation(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-interactive-element-to-noninteractive-role", `const Component = () => <button role="presentation">Save</button>;`, "Interactive")
}
