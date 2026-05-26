package linthost

import "testing"

// TestJsxA11yAltTextRequiresImgAlt verifies img elements need text alternatives.
//
// This pins the TSX intrinsic-element branch for `jsx-a11y/alt-text`, where the
// lint engine must read JSX attributes without relying on React component metadata.
//
// 1. Parse an img without alt or ARIA labeling attributes.
// 2. Enable only `jsx-a11y/alt-text`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAltTextRequiresImgAlt(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/alt-text", `const Component = () => <img src="avatar.png" />;`, "alt text")
}
