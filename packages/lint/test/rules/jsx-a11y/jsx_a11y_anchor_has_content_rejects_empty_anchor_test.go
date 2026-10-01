package linthost

import "testing"

// TestJsxA11yAnchorHasContentRejectsEmptyAnchor verifies
// jsx-a11y/anchor-has-content reports empty paired and self-closing anchors
// and accepts an anchor with text.
//
// Empty links are invisible to assistive technology, and both JSX element
// syntaxes can omit their content.
//
// 1. Run only `jsx-a11y/anchor-has-content` over `<a href="/home"></a>` and
//    over `<a href="/home" />`, expecting one finding each whose message
//    contains "content".
// 2. Run it over `<a href="/home">Home</a>` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses each TSX source and runs NewEngine.Run with only jsx-a11y/anchor-has-content enabled. The paired empty anchor and the self-closing anchor each yield exactly one ordinary SeverityError finding from that rule whose message contains "content"; assertJsxA11yRuleSkips requires zero findings for the anchor containing Home.
// @evidence contracts/testing.md#independent-expectations Visible text gives a link its accessible name, so an anchor with neither text nor a label is a violation in both element syntaxes. The three literal sources and the "content" fragment are authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases All three anchors share the /home href; the paired and self-closing forms report and the form with child text does not. Other accessible-name sources (aria-label and similar) are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with two assertJsxA11yRuleFinds calls and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAnchorHasContentRejectsEmptyAnchor(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-has-content", `const Component = () => <a href="/home"></a>;`, "content")
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-has-content", `const Component = () => <a href="/home" />;`, "content")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-has-content", "declare const props: object; const Component = () => <a href=\"/home\">Home</a>;")
}
