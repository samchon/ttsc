package linthost

import "testing"

// TestJsxA11yControlHasAssociatedLabelRequiresButtonLabel verifies controls need names.
//
// This catches native interactive controls that are otherwise focusable but do
// not expose text, aria-label, aria-labelledby, title, or children.
//
// 1. Parse an empty button.
// 2. Enable only `jsx-a11y/control-has-associated-label`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify empty button has no accessible name; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Text content supplies the control label. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases An empty button reports; adding its Save text label is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yControlHasAssociatedLabelRequiresButtonLabel owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yControlHasAssociatedLabelRequiresButtonLabel(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/control-has-associated-label", `const Component = () => <button />;`, "label")
  assertJsxA11yRuleSkips(t, "jsx-a11y/control-has-associated-label", "declare const props: object; const Component = () => <button>Save</button>;")
}
