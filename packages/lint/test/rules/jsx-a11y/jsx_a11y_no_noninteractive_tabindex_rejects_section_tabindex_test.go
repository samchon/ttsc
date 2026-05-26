package linthost

import "testing"

// TestJsxA11yNoNoninteractiveTabindexRejectsSectionTabindex verifies tabIndex is limited to interactive elements.
//
// Focus order should not include static regions unless they have interactive
// semantics. This case covers numeric JSX expression values.
//
// 1. Parse a section with tabIndex 0.
// 2. Enable only `jsx-a11y/no-noninteractive-tabindex`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoNoninteractiveTabindexRejectsSectionTabindex(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-noninteractive-tabindex", `const Component = () => <section tabIndex={0} />;`, "tabIndex")
}
