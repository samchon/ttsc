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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify email input requests URL autofill; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations email purpose matches the email value domain. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases An email input with url autocomplete reports; replacing its purpose with email is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAutocompleteValidRejectsInappropriateInputType owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAutocompleteValidRejectsInappropriateInputType(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input type="email" autoComplete="url" />;`, "input type")
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", "declare const props: object; const Component = () => <input type=\"email\" autoComplete=\"email\" />;")
}
