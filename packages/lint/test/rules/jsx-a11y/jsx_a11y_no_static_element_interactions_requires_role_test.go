package linthost

import "testing"

// TestJsxA11yNoStaticElementInteractionsRequiresRole verifies static elements with handlers need roles.
//
// A span with an activation handler has no native semantics. This rule asks for
// an explicit role when static markup becomes interactive.
//
// 1. Parse a span with onClick and no role.
// 2. Enable only `jsx-a11y/no-static-element-interactions`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoStaticElementInteractionsRequiresRole(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-static-element-interactions", `const Component = () => <span onClick={() => {}} />;`, "Static")
}
