package linthost

import "testing"

// TestJsxA11yAutocompleteValidRejectsInvalidTokenSequence verifies token grammar.
//
// Contact qualifiers apply only to contact purposes, and every detail list has
// exactly one terminal purpose. Known tokens in an invalid order must fail.
//
// 1. Parse qualified, multiple-purpose, mixed-state, and empty-section lists.
// 2. Enable only `jsx-a11y/autocomplete-valid`.
// 3. Assert every invalid sequence reports a diagnostic.
func TestJsxA11yAutocompleteValidRejectsInvalidTokenSequence(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="home url" />;`, "invalid token sequence")
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="name email" />;`, "invalid token sequence")
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="on email" />;`, "invalid token sequence")
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="section- name" />;`, "invalid token sequence")
}
