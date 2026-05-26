package linthost

import "testing"

// TestJsxA11yNoNoninteractiveElementInteractionsRejectsLiClick verifies non-interactive elements avoid handlers.
//
// List items have structural semantics, not activation semantics. This rule
// catches direct interaction handlers on those known non-interactive tags.
//
// 1. Parse an li with onClick.
// 2. Enable only `jsx-a11y/no-noninteractive-element-interactions`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoNoninteractiveElementInteractionsRejectsLiClick(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-noninteractive-element-interactions", `const Component = () => <li onClick={() => {}}>Item</li>;`, "Non-interactive")
}
