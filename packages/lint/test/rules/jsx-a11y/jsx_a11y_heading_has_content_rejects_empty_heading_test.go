package linthost

import "testing"

// TestJsxA11yHeadingHasContentRejectsEmptyHeading verifies headings need content.
//
// Both normal empty headings and self-closing headings omit child text. The
// rule must visit both JSX node kinds for intrinsic heading tags.
//
// 1. Parse normal and self-closing empty h2 elements.
// 2. Enable only `jsx-a11y/heading-has-content`.
// 3. Assert each empty heading reports a diagnostic.
func TestJsxA11yHeadingHasContentRejectsEmptyHeading(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/heading-has-content", `const Component = () => <h2></h2>;`, "Headings")
  assertJsxA11yRuleFinds(t, "jsx-a11y/heading-has-content", `const Component = () => <h2 />;`, "Headings")
}
