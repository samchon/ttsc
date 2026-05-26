package linthost

import "testing"

// TestJsxA11yAriaPropsRejectsUnknownProp verifies unknown aria-* attributes are rejected.
//
// The rule is attribute-local and should catch spelling mistakes before any role
// compatibility checks run.
//
// 1. Parse a div with an invalid `aria-labeledby` attribute.
// 2. Enable only `jsx-a11y/aria-props`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAriaPropsRejectsUnknownProp(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/aria-props", `const Component = () => <div aria-labeledby="title" />;`, "Unknown ARIA")
}
