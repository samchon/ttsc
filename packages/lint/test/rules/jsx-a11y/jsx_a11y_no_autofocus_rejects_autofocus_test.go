package linthost

import "testing"

// TestJsxA11yNoAutofocusRejectsAutofocus verifies autoFocus is rejected.
//
// Autofocus can move users unexpectedly when a view loads. This rule is an
// attribute-local check and should fire on JSX camel-case spelling.
//
// 1. Parse an input with autoFocus.
// 2. Enable only `jsx-a11y/no-autofocus`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoAutofocusRejectsAutofocus(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-autofocus", `const Component = () => <input autoFocus />;`, "autoFocus")
}
