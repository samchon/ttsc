package linthost

import "testing"

// TestJsxA11yAriaRoleRejectsUnknownRole verifies jsx-a11y/aria-role reports an
// unknown role token and accepts a supported role.
//
// Role validation does not depend on the JSX tag, so the rule reads the role
// attribute and validates its token list directly.
//
//  1. Run only `jsx-a11y/aria-role` over `<div role="banana" />` and expect one
//     finding whose message contains "valid ARIA role".
//  2. Run it over `<div role="button" />` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/aria-role enabled. role="banana" yields exactly one ordinary SeverityError finding from that rule whose message contains "valid ARIA role"; assertJsxA11yRuleSkips requires zero findings for role="button".
// @evidence contracts/testing.md#independent-expectations button is a defined ARIA role and banana is not. The two literal sources and the "valid ARIA role" fragment are authored from the ARIA role vocabulary.
// @evidence contracts/testing.md#distinguishing-cases The two divs differ only in the role token. Empty roles and multi-token role lists are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAriaRoleRejectsUnknownRole(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-role", `const Component = () => <div role="banana" />;`, "valid ARIA role")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-role", "declare const props: object; const Component = () => <div role=\"button\" />;")
}
