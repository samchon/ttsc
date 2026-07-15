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
func TestJsxA11yAnchorHasContentRejectsEmptyAnchor(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-has-content", `const Component = () => <a href="/home"></a>;`, "content")
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-has-content", `const Component = () => <a href="/home" />;`, "content")
}
