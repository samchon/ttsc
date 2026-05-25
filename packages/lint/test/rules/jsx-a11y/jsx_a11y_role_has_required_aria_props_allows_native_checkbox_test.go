package linthost

import "testing"

// TestJsxA11yRoleHasRequiredAriaPropsAllowsNativeCheckbox verifies native checkbox controls keep native state.
//
// Native input checkboxes expose checked state through the control itself. This
// pins the rule to explicit role attributes so implicit native roles do not need
// duplicate ARIA state.
//
// 1. Parse an input type checkbox without aria-checked.
// 2. Enable only `jsx-a11y/role-has-required-aria-props`.
// 3. Assert no diagnostic is reported.
func TestJsxA11yRoleHasRequiredAriaPropsAllowsNativeCheckbox(t *testing.T) {
	assertJsxA11yRuleSkips(t, "jsx-a11y/role-has-required-aria-props", `const Component = () => <input type="checkbox" />;`)
}
