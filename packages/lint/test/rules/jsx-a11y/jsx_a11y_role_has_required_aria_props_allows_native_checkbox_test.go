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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify native checkbox without duplicate aria-checked remains accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations Native input checkbox state already supplies its implicit role state; required-property checks apply to explicit roles. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The explicit-role RequiresCheckboxChecked case owns missing state.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yRoleHasRequiredAriaPropsAllowsNativeCheckbox owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yRoleHasRequiredAriaPropsAllowsNativeCheckbox(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/role-has-required-aria-props", `const Component = () => <input type="checkbox" />;`)
}
