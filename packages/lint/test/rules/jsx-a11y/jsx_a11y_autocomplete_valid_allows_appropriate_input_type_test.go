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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify ten compatible, fallback, shorthand, non-string or out-of-scope values remain accepted; clean sources require zero findings, so recovered-panic and unrelated reports also fail.
// @evidence contracts/testing.md#independent-expectations The HTML autocomplete contract permits the matching purpose/type and ordered token forms; ttsc leaves unsupported non-string and non-input shapes alone. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Email/URL matching, invalid type text fallback, section/contact order, username webauthn, non-string attributes and div scope remain distinct controls.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAutocompleteValidAllowsAppropriateInputType owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
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
