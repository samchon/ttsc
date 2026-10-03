package linthost

import "testing"

// TestJsxA11yLabelHasAssociatedControlRequiresForOrChild verifies labels need controls.
//
// The rule checks both association patterns: htmlFor/for attributes and nested
// form controls. This failing case covers the absence of both.
//
// 1. Parse a label with text but no associated control.
// 2. Enable only `jsx-a11y/label-has-associated-control`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify label has neither reference nor nested control; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The authored htmlFor attribute supplies the static reference marker this rule accepts. The literal pair pins that attribute policy without sampling implementation output; no matching control exists in this fixture, so target existence or a working browser association is not asserted.
// @evidence contracts/testing.md#distinguishing-cases A text-only Name label reports; adding htmlFor="name" is clean. This host owns reference-attribute presence, not target resolution or the nested-control branch.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yLabelHasAssociatedControlRequiresForOrChild owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yLabelHasAssociatedControlRequiresForOrChild(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/label-has-associated-control", `const Component = () => <label>Name</label>;`, "control")
  assertJsxA11yRuleSkips(t, "jsx-a11y/label-has-associated-control", "declare const props: object; const Component = () => <label htmlFor=\"name\">Name</label>;")
}
