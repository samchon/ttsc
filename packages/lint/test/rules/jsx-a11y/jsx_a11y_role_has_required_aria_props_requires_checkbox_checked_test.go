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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify checkbox role omits checked state; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations aria-checked supplies the required state. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases An explicit checkbox-role div without aria-checked reports; adding aria-checked="false" is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yRoleHasRequiredAriaPropsRequiresCheckboxChecked owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yRoleHasRequiredAriaPropsRequiresCheckboxChecked(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/role-has-required-aria-props", `const Component = () => <div role="checkbox" />;`, "aria-checked")
  assertJsxA11yRuleSkips(t, "jsx-a11y/role-has-required-aria-props", "declare const props: object; const Component = () => <div role=\"checkbox\" aria-checked=\"false\" />;")
}
