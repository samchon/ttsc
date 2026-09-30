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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify native button with aria-pressed remains accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations Native toggle buttons support pressed state without an explicit role declaration. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases AllowsExplicitButtonPressed owns the explicit-role shape and RejectsButtonChecked owns unsupported checked state.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yRoleSupportsAriaPropsAllowsNativeButtonPressed owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yRoleSupportsAriaPropsAllowsNativeButtonPressed(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/role-supports-aria-props", `const Component = () => <button aria-pressed="true">Bold</button>;`)
}
