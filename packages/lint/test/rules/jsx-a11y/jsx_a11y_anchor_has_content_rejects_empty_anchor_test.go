package linthost

import "testing"

// TestJsxA11yAnchorHasContentRejectsEmptyAnchor verifies anchors need content.
//
// Empty links are invisible to assistive technology. Both normal and
// self-closing JSX elements can omit accessible child content.
//
// 1. Parse normal and self-closing anchors with no accessible label.
// 2. Enable only `jsx-a11y/anchor-has-content`.
// 3. Assert each empty anchor reports a diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify normal and self-closing anchors have no accessible content; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Visible text provides the link name for both element syntaxes. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Empty paired and self-closing anchors report; adding Home content with the same /home href is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAnchorHasContentRejectsEmptyAnchor owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAnchorHasContentRejectsEmptyAnchor(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-has-content", `const Component = () => <a href="/home"></a>;`, "content")
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-has-content", `const Component = () => <a href="/home" />;`, "content")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-has-content", "declare const props: object; const Component = () => <a href=\"/home\">Home</a>;")
}
