package linthost

import "testing"

// TestJsxA11yAriaUnsupportedElementsRejectsMetaAria verifies
// jsx-a11y/aria-unsupported-elements reports an aria-* attribute on a meta
// element and accepts the same attribute on a div.
//
// Elements such as meta cannot expose ARIA semantics, so the rule guards the
// tag rather than the attribute.
//
// 1. Run only the rule over `<meta aria-label="description" />` and expect one
//    finding whose message contains "ARIA".
// 2. Run it over `<div aria-label="description" />` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/aria-unsupported-elements enabled. The meta element with aria-label yields exactly one ordinary SeverityError finding from that rule whose message contains "ARIA"; assertJsxA11yRuleSkips requires zero findings for a div with the same attribute.
// @evidence contracts/testing.md#independent-expectations The metadata-tag restriction prohibits explicit ARIA on meta, while this rule does not classify div as an unsupported tag. The authored tag pair pins that rule boundary; accepting div here does not certify its accessible name or compliance with other ARIA rules.
// @evidence contracts/testing.md#distinguishing-cases The two elements carry the same aria-label and differ only in the tag. The html, script and style tags and the role attribute are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAriaUnsupportedElementsRejectsMetaAria(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-unsupported-elements", `const Component = () => <meta aria-label="description" />;`, "ARIA")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-unsupported-elements", "declare const props: object; const Component = () => <div aria-label=\"description\" />;")
}
