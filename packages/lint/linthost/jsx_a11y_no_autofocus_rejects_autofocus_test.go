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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify the autoFocus attribute is reported; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The input without autoFocus contains no declarative autofocus request. Literal findings follow that static attribute policy without sampling implementation output; browser focus or script-driven focus is not observed.
// @evidence contracts/testing.md#distinguishing-cases An input with bare autoFocus reports; removing the autoFocus attribute is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoAutofocusRejectsAutofocus owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoAutofocusRejectsAutofocus(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-autofocus", `const Component = () => <input autoFocus />;`, "autoFocus")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-autofocus", "declare const props: object; const Component = () => <input />;")
}
