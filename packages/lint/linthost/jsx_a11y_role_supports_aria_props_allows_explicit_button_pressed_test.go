package linthost

import "testing"

// TestJsxA11yRoleSupportsAriaPropsAllowsExplicitButtonPressed verifies button roles support aria-pressed.
//
// Explicit ARIA button roles can represent toggle buttons. This keeps the
// supported-property table aligned with valid button state while preserving the
// rejection for checked state unsupported by button.
//
// 1. Parse a div with role button and aria-pressed.
// 2. Enable only `jsx-a11y/role-supports-aria-props`.
// 3. Assert no diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify explicit button role with aria-pressed remains accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations ARIA button supports pressed toggle state but not aria-checked; checked state belongs to supported roles such as checkbox and radio. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases RoleSupportsAriaPropsRejectsButtonChecked owns the unsupported state distinction.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yRoleSupportsAriaPropsAllowsExplicitButtonPressed owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yRoleSupportsAriaPropsAllowsExplicitButtonPressed(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/role-supports-aria-props", `const Component = () => <div role="button" aria-pressed="true">Bold</div>;`)
}
