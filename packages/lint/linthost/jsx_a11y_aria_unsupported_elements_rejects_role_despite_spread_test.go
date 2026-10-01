package linthost

import "testing"

// TestJsxA11yAriaUnsupportedElementsRejectsRoleDespiteSpread verifies a spread
// does not suppress an explicit role on an unsupported element.
//
// The rule judges explicitly written role and aria-* attributes on meta, html,
// script and style, so a sibling spread changes nothing about the violation.
// This also guards the former crash of the attribute walk on spread members.
//
// 1. Run only `jsx-a11y/aria-unsupported-elements` over
//    `<meta charSet="utf-8" role="none" {...props} />` and expect one finding
//    whose message contains "ARIA roles".
// 2. Run it over `<meta charSet="utf-8" {...props} />` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/aria-unsupported-elements enabled. The meta element with role="none" and a spread yields exactly one ordinary SeverityError finding from that rule whose message contains "ARIA roles"; assertJsxA11yRuleSkips requires zero findings for the same meta and spread without the role.
// @evidence contracts/testing.md#independent-expectations An explicitly written role on a metadata element is a violation regardless of an unknown spread, and a meta with only charSet and a spread declares no ARIA semantics. The two literal sources and the "ARIA roles" fragment are authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases The two sources keep the meta tag, charSet and spread, and differ only in the role attribute, so the spread cannot be what silences or triggers the report.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAriaUnsupportedElementsRejectsRoleDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-unsupported-elements", `declare const props: object; const Component = () => <meta charSet="utf-8" role="none" {...props} />;`, "ARIA roles")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-unsupported-elements", "declare const props: object; const Component = () => <meta charSet=\"utf-8\" {...props} />;")
}
