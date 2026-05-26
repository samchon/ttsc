package linthost

import "testing"

// TestJsxA11yRoleHasRequiredAriaPropsRequiresCheckboxChecked verifies role-required props.
//
// Some ARIA roles are incomplete without state attributes. This pins the
// required-property table for literal explicit roles.
//
// 1. Parse a div with role checkbox and no aria-checked.
// 2. Enable only `jsx-a11y/role-has-required-aria-props`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yRoleHasRequiredAriaPropsRequiresCheckboxChecked(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/role-has-required-aria-props", `const Component = () => <div role="checkbox" />;`, "aria-checked")
}
