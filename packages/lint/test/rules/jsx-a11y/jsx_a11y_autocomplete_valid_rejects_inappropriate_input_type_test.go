package linthost

import "testing"

// TestJsxA11yAutocompleteValidRejectsInappropriateInputType verifies purpose/type compatibility.
//
// A registered autofill purpose can still be invalid for a specialized input.
// URL data must not be offered to an email control.
//
// 1. Parse an email input with the registered `url` autocomplete purpose.
// 2. Enable only `jsx-a11y/autocomplete-valid`.
// 3. Assert one compatibility diagnostic is reported.
func TestJsxA11yAutocompleteValidRejectsInappropriateInputType(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input type="email" autoComplete="url" />;`, "input type")
}
