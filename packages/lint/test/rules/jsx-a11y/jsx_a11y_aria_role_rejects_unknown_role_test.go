package linthost

import "testing"

// TestJsxA11yAriaRoleRejectsUnknownRole verifies role names are checked.
//
// Role validation is independent of JSX tag semantics, so this case ensures the
// native rule reads the role attribute and validates its token list directly.
//
// 1. Parse a div with an unknown role token.
// 2. Enable only `jsx-a11y/aria-role`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAriaRoleRejectsUnknownRole(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/aria-role", `const Component = () => <div role="banana" />;`, "valid ARIA role")
}
