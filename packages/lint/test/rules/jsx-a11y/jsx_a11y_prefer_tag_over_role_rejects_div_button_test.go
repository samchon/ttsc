package linthost

import "testing"

// TestJsxA11yPreferTagOverRoleRejectsDivButton verifies native tags are preferred.
//
// When a simple intrinsic tag exists, using role on div/span is a weaker
// substitute. This case covers the role-to-native suggestion table.
//
// 1. Parse a div with role button.
// 2. Enable only `jsx-a11y/prefer-tag-over-role`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yPreferTagOverRoleRejectsDivButton(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/prefer-tag-over-role", `const Component = () => <div role="button" />;`, "native")
}
