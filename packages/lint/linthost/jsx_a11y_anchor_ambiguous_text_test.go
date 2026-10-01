package linthost

import "testing"

// TestJsxA11yAnchorAmbiguousTextRejectsClickHere verifies
// jsx-a11y/anchor-ambiguous-text reports an anchor whose text is the ambiguous
// phrase "click here" and accepts descriptive text.
//
// Screen-reader users navigate by listing links, where "click here" or "more"
// carry no information about the destination.
//
// 1. Run only `jsx-a11y/anchor-ambiguous-text` over
//    `<a href="/docs">click here</a>` and expect one finding whose message
//    contains "ambiguous".
// 2. Run it over `<a href="/docs">Documentation</a>` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/anchor-ambiguous-text enabled. The "click here" anchor yields exactly one ordinary SeverityError finding from that rule whose message contains "ambiguous"; assertJsxA11yRuleSkips requires zero findings for the Documentation anchor.
// @evidence contracts/testing.md#independent-expectations Descriptive link text identifies the destination for assistive navigation, while "click here" does not. The two literal sources and the "ambiguous" message fragment are authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases The two anchors share the same /docs href and differ only in their text. The other phrases in the rule's list ("here", "link", "more", "read more", ...) and case or whitespace normalisation are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAnchorAmbiguousTextRejectsClickHere(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-ambiguous-text", `const Component = () => <a href="/docs">click here</a>;`, "ambiguous")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-ambiguous-text", "declare const props: object; const Component = () => <a href=\"/docs\">Documentation</a>;")
}
