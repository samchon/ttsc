package linthost

import "testing"

// TestJsxA11yAnchorHasContentRejectsEmptyAnchor verifies anchors need content.
//
// Empty links are invisible to assistive technology. This case locks the child
// text scan for normal JSX elements rather than self-closing attribute-only nodes.
//
// 1. Parse an anchor with an href but no children or accessible label.
// 2. Enable only `jsx-a11y/anchor-has-content`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAnchorHasContentRejectsEmptyAnchor(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-has-content", `const Component = () => <a href="/home"></a>;`, "content")
}
