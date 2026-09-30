package linthost

import "testing"

// TestJsxA11yAriaRoleRejectsUnknownRole verifies role names are checked.
//
// Role validation is independent of JSX tag semantics, so this case ensures the
// native rule reads the role attribute and validates its token list directly.
//
// 1. Parse a div with an unknown role token.
// 2. Enable only `jsx-a11y/aria-role`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify banana is an unknown role; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations button is a supported ARIA role token. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The unknown banana role reports; button is clean for role vocabulary validation, independently of other focus rules.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAriaRoleRejectsUnknownRole owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAriaRoleRejectsUnknownRole(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-role", `const Component = () => <div role="banana" />;`, "valid ARIA role")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-role", "declare const props: object; const Component = () => <div role=\"button\" />;")
}
