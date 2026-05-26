package linthost

import "testing"

// TestJsxA11yAriaUnsupportedElementsRejectsMetaAria verifies inert metadata tags reject ARIA.
//
// Some intrinsic elements cannot expose ARIA semantics. This locks the tag-level
// guard for elements that should not carry role or aria-* attributes.
//
// 1. Parse a meta element with aria-label.
// 2. Enable only `jsx-a11y/aria-unsupported-elements`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAriaUnsupportedElementsRejectsMetaAria(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/aria-unsupported-elements", `const Component = () => <meta aria-label="description" />;`, "ARIA")
}
