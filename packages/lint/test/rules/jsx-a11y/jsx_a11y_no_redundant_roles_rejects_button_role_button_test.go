package linthost

import "testing"

// TestJsxA11yNoRedundantRolesRejectsButtonRoleButton verifies native roles are not repeated.
//
// Redundant roles add noise and can hide accidental semantic changes. This
// case covers implicit role detection for native button elements.
//
// 1. Parse a button with role button.
// 2. Enable only `jsx-a11y/no-redundant-roles`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoRedundantRolesRejectsButtonRoleButton(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-redundant-roles", `const Component = () => <button role="button">Save</button>;`, "redundant")
}
