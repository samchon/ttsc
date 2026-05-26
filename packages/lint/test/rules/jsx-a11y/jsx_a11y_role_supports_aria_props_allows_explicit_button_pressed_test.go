package linthost

import "testing"

// TestJsxA11yRoleSupportsAriaPropsAllowsExplicitButtonPressed verifies button roles support aria-pressed.
//
// Explicit ARIA button roles can represent toggle buttons. This keeps the
// supported-property table aligned with valid button state while preserving the
// rejection for checkbox-only state.
//
// 1. Parse a div with role button and aria-pressed.
// 2. Enable only `jsx-a11y/role-supports-aria-props`.
// 3. Assert no diagnostic is reported.
func TestJsxA11yRoleSupportsAriaPropsAllowsExplicitButtonPressed(t *testing.T) {
	assertJsxA11yRuleSkips(t, "jsx-a11y/role-supports-aria-props", `const Component = () => <div role="button" aria-pressed="true">Bold</div>;`)
}
