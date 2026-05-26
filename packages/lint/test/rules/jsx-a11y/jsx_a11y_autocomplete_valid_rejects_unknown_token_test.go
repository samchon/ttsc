package linthost

import "testing"

// TestJsxA11yAutocompleteValidRejectsUnknownToken verifies autocomplete tokens are checked.
//
// Browser autocomplete values are a finite token vocabulary. The rule should
// flag known literal typos while avoiding dynamic expressions.
//
// 1. Parse an input with an invalid autocomplete token.
// 2. Enable only `jsx-a11y/autocomplete-valid`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAutocompleteValidRejectsUnknownToken(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="definitely" />;`, "autocomplete")
}
