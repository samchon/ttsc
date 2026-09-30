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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify definitely is not an autocomplete token; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations name is a registered purpose in the supported HTML token vocabulary. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Unknown autocomplete purpose definitely reports; the supported name token is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAutocompleteValidRejectsUnknownToken owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAutocompleteValidRejectsUnknownToken(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="definitely" />;`, "autocomplete")
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", "declare const props: object; const Component = () => <input autoComplete=\"name\" />;")
}
