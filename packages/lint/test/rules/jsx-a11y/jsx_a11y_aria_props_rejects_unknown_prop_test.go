package linthost

import "testing"

// TestJsxA11yAriaPropsRejectsUnknownProp verifies unknown aria-* attributes are rejected.
//
// The rule is attribute-local and should catch spelling mistakes before any role
// compatibility checks run.
//
// 1. Parse a div with an invalid `aria-labeledby` attribute.
// 2. Enable only `jsx-a11y/aria-props`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify aria-labeledby is misspelled; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The ARIA attribute vocabulary spells the reference aria-labelledby. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Misspelled aria-labeledby reports; canonical aria-labelledby with the same title identifier is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAriaPropsRejectsUnknownProp owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAriaPropsRejectsUnknownProp(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-props", `const Component = () => <div aria-labeledby="title" />;`, "Unknown ARIA")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-props", "declare const props: object; const Component = () => <div aria-labelledby=\"title\" />;")
}
