package linthost

import "testing"

// TestJsxA11yAriaProptypesRejectsBadBoolean verifies literal ARIA value validation.
//
// This covers the static value path: dynamic expressions are left alone, while
// known string literals are checked against the property shape.
//
// 1. Parse an element with `aria-hidden="maybe"`.
// 2. Enable only `jsx-a11y/aria-proptypes`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAriaProptypesRejectsBadBoolean(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/aria-proptypes", `const Component = () => <div aria-hidden="maybe" />;`, "true or false")
}
