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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify button role receives checkbox-only aria-checked; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations aria-pressed is the supported toggle-button state. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The button-role div with aria-checked reports; replacing that property with aria-pressed="true" is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yRoleSupportsAriaPropsRejectsButtonChecked owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yRoleSupportsAriaPropsRejectsButtonChecked(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/role-supports-aria-props", `const Component = () => <div role="button" aria-checked="true" />;`, "aria-checked")
  assertJsxA11yRuleSkips(t, "jsx-a11y/role-supports-aria-props", "declare const props: object; const Component = () => <div role=\"button\" aria-pressed=\"true\" />;")
}
