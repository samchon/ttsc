package linthost

import "testing"

// TestJsxA11yNoRedundantRolesRejectsButtonRoleButton verifies native roles are not repeated.
//
// Redundant roles add noise and can hide accidental semantic changes. This
// case covers implicit role detection for native button elements.
//
// 1. Parse a button with role button.
// 2. Enable only `jsx-a11y/no-redundant-roles`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify native button repeats its implicit button role; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Omitting explicit role retains the same native semantics. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The native button redundantly declaring button role reports; removing only the duplicate role is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoRedundantRolesRejectsButtonRoleButton owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoRedundantRolesRejectsButtonRoleButton(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-redundant-roles", `const Component = () => <button role="button">Save</button>;`, "redundant")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-redundant-roles", "declare const props: object; const Component = () => <button>Save</button>;")
}
