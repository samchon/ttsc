package linthost

import "testing"

// TestJsxA11yAutocompleteValidAllowsAppropriateInputType verifies compatible purposes remain valid.
//
// Specialized inputs should retain the autofill purpose designed for their
// value domain. Invalid types use HTML's text fallback; non-inputs are ignored.
//
// 1. Parse matching inputs and a non-input carrying an arbitrary value.
// 2. Enable only `jsx-a11y/autocomplete-valid`.
// 3. Assert each compatible pair reports no diagnostic.
func TestJsxA11yAutocompleteValidAllowsAppropriateInputType(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input type="email" autoComplete="email" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input type="url" autoComplete="url" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input type="potato" autoComplete="name" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input type autoComplete="name" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input type="email" autoComplete="section-blue shipping home email" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="username webauthn" />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete={true} />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete={42} />;`)
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", `const Component = () => <div autoComplete="definitely" />;`)
}
