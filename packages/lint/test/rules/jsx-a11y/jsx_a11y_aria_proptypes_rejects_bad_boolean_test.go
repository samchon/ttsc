package linthost

import "testing"

// TestJsxA11yAriaProptypesRejectsBadBoolean verifies literal ARIA value validation.
//
// This covers the static value path: dynamic expressions are left alone, while
// known string literals are checked against the property shape.
//
// 1. Parse an element with `aria-hidden="maybe"`.
// 2. Enable only `jsx-a11y/aria-proptypes`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify aria-hidden maybe is not a boolean value; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The literal false is in the supported boolean vocabulary. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases aria-hidden="maybe" reports; the supported boolean token false is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAriaProptypesRejectsBadBoolean owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAriaProptypesRejectsBadBoolean(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-proptypes", `const Component = () => <div aria-hidden="maybe" />;`, "true or false")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-proptypes", "declare const props: object; const Component = () => <div aria-hidden=\"false\" />;")
}
