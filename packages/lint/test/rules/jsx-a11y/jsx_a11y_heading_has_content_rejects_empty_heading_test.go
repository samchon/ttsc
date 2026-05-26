package linthost

import "testing"

// TestJsxA11yHeadingHasContentRejectsEmptyHeading verifies headings need content.
//
// Heading text is discovered through JSX children, not attributes alone. This
// case pins empty child-list handling for intrinsic heading tags.
//
// 1. Parse an empty h2 element.
// 2. Enable only `jsx-a11y/heading-has-content`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yHeadingHasContentRejectsEmptyHeading(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/heading-has-content", `const Component = () => <h2></h2>;`, "Headings")
}
