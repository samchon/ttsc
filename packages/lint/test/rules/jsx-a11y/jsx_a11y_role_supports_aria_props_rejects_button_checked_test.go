package linthost

import "testing"

// TestJsxA11yRoleSupportsAriaPropsRejectsButtonChecked verifies role-specific ARIA support.
//
// Valid ARIA properties are not valid on every role. This catches a literal
// state attribute that belongs on checkbox-like roles, not button.
//
// 1. Parse a div with role button and aria-checked.
// 2. Enable only `jsx-a11y/role-supports-aria-props`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yRoleSupportsAriaPropsRejectsButtonChecked(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/role-supports-aria-props", `const Component = () => <div role="button" aria-checked="true" />;`, "aria-checked")
}
