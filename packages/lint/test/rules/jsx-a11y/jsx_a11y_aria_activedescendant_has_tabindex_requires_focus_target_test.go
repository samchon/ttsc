package linthost

import "testing"

// TestJsxA11yAriaActivedescendantHasTabindexRequiresFocusTarget verifies active descendants need focus.
//
// `aria-activedescendant` only works from a focused container, so the lint rule
// must connect the ARIA attribute to a sibling `tabIndex` attribute on the same tag.
//
// 1. Parse a div with aria-activedescendant and no tabIndex.
// 2. Enable only `jsx-a11y/aria-activedescendant-has-tabindex`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAriaActivedescendantHasTabindexRequiresFocusTarget(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/aria-activedescendant-has-tabindex", `const Component = () => <div aria-activedescendant="item-1" />;`, "tabIndex")
}
