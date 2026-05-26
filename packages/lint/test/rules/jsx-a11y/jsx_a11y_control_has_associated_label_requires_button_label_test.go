package linthost

import "testing"

// TestJsxA11yControlHasAssociatedLabelRequiresButtonLabel verifies controls need names.
//
// This catches native interactive controls that are otherwise focusable but do
// not expose text, aria-label, aria-labelledby, title, or children.
//
// 1. Parse an empty button.
// 2. Enable only `jsx-a11y/control-has-associated-label`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yControlHasAssociatedLabelRequiresButtonLabel(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/control-has-associated-label", `const Component = () => <button />;`, "label")
}
