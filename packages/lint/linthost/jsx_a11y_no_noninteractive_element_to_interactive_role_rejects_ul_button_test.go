package linthost

import "testing"

// TestJsxA11yNoNoninteractiveElementToInteractiveRoleRejectsUlButton verifies role upgrades are rejected.
//
// Structural elements should not become controls via role alone. This pins the
// non-interactive intrinsic tag plus interactive role branch.
//
// 1. Parse a ul with role button.
// 2. Enable only `jsx-a11y/no-noninteractive-element-to-interactive-role`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify structural ul is assigned button role; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A plain ul retains the list role. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The ul with button role reports; the same list element without the interactive role is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoNoninteractiveElementToInteractiveRoleRejectsUlButton owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoNoninteractiveElementToInteractiveRoleRejectsUlButton(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-noninteractive-element-to-interactive-role", `const Component = () => <ul role="button" />;`, "Non-interactive")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-noninteractive-element-to-interactive-role", "declare const props: object; const Component = () => <ul />;")
}
