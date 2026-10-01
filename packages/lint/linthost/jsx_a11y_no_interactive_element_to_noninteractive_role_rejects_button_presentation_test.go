package linthost

import "testing"

// TestJsxA11yNoInteractiveElementToNoninteractiveRoleRejectsButtonPresentation verifies role downgrades are rejected.
//
// Native controls should keep their interactive semantics. This case covers the
// implicit-role branch for a button with a non-interactive explicit role.
//
// 1. Parse a button with role presentation.
// 2. Enable only `jsx-a11y/no-interactive-element-to-noninteractive-role`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify button is downgraded to presentation; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A native button without that role preserves its interactive semantics. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases A native button with presentation role reports; removing that incompatible role preserves Save and is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoInteractiveElementToNoninteractiveRoleRejectsButtonPresentation owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoInteractiveElementToNoninteractiveRoleRejectsButtonPresentation(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-interactive-element-to-noninteractive-role", `const Component = () => <button role="presentation">Save</button>;`, "Interactive")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-interactive-element-to-noninteractive-role", "declare const props: object; const Component = () => <button>Save</button>;")
}
