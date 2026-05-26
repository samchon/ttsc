package linthost

import "testing"

// TestJsxA11yIframeHasTitleRequiresTitle verifies iframe titles are required.
//
// Iframes need a non-empty title for assistive technology. This test covers the
// self-closing JSX branch.
//
// 1. Parse an iframe without title.
// 2. Enable only `jsx-a11y/iframe-has-title`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yIframeHasTitleRequiresTitle(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/iframe-has-title", `const Component = () => <iframe src="/embed" />;`, "title")
}
