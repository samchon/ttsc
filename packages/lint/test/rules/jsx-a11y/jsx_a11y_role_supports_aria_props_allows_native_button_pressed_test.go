package linthost

import "testing"

// TestJsxA11yRoleSupportsAriaPropsAllowsNativeButtonPressed verifies native toggle buttons support aria-pressed.
//
// Native buttons may expose toggle state through aria-pressed. This pins the
// rule to explicit role attributes so implicit native roles do not reject valid
// control ARIA.
//
// 1. Parse a button with aria-pressed and no explicit role.
// 2. Enable only `jsx-a11y/role-supports-aria-props`.
// 3. Assert no diagnostic is reported.
func TestJsxA11yRoleSupportsAriaPropsAllowsNativeButtonPressed(t *testing.T) {
	assertJsxA11yRuleSkips(t, "jsx-a11y/role-supports-aria-props", `const Component = () => <button aria-pressed="true">Bold</button>;`)
}
