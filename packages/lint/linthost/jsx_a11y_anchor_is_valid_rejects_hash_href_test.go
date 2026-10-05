package linthost

import "testing"

// TestJsxA11yAnchorIsValidRejectsHashHref verifies jsx-a11y/anchor-is-valid
// reports a hash-only href and accepts a real relative path.
//
// The rule handles the high-confidence invalid targets that need no router
// settings: an empty href, a hash-only href and a javascript: URL.
//
//  1. Run only `jsx-a11y/anchor-is-valid` over `<a href="#">Home</a>` and
//     expect one finding whose message contains "href".
//  2. Run it over `<a href="/home">Home</a>` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/anchor-is-valid enabled. The anchor with href="#" yields exactly one ordinary SeverityError finding from that rule whose message contains "href"; assertJsxA11yRuleSkips requires zero findings for href="/home".
// @evidence contracts/testing.md#independent-expectations The lint policy treats the literal hash-only href as a placeholder and accepts the authored /home path. The literal pair and message fragment are independent policy expectations; no browser navigation or destination existence is asserted.
// @evidence contracts/testing.md#distinguishing-cases The two anchors share the Home label and differ only in the href value. The empty href and javascript: URL branches, and spread handling, are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAnchorIsValidRejectsHashHref(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-is-valid", `const Component = () => <a href="#">Home</a>;`, "href")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-is-valid", "declare const props: object; const Component = () => <a href=\"/home\">Home</a>;")
}
