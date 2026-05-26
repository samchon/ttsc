package linthost

import "testing"

// TestJsxA11yLabelHasAssociatedControlRequiresForOrChild verifies labels need controls.
//
// The rule checks both association patterns: htmlFor/for attributes and nested
// form controls. This failing case covers the absence of both.
//
// 1. Parse a label with text but no associated control.
// 2. Enable only `jsx-a11y/label-has-associated-control`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yLabelHasAssociatedControlRequiresForOrChild(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/label-has-associated-control", `const Component = () => <label>Name</label>;`, "control")
}
