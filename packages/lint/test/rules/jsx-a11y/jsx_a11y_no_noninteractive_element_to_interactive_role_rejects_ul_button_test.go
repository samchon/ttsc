package linthost

import "testing"

// TestJsxA11yNoNoninteractiveElementToInteractiveRoleRejectsUlButton verifies role upgrades are rejected.
//
// Structural elements should not become controls via role alone. This pins the
// non-interactive intrinsic tag plus interactive role branch.
//
// 1. Parse a ul with role button.
// 2. Enable only `jsx-a11y/no-noninteractive-element-to-interactive-role`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoNoninteractiveElementToInteractiveRoleRejectsUlButton(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-noninteractive-element-to-interactive-role", `const Component = () => <ul role="button" />;`, "Non-interactive")
}
