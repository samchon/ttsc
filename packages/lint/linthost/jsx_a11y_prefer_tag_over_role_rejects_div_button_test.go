package linthost

import "testing"

// TestJsxA11yPreferTagOverRoleRejectsDivButton verifies native tags are preferred.
//
// When a simple intrinsic tag exists, using role on div/span is a weaker
// substitute. This case covers the role-to-native suggestion table.
//
// 1. Parse a div with role button.
// 2. Enable only `jsx-a11y/prefer-tag-over-role`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify div declares a button role where the policy prefers a native button tag; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The button tag supplies native control semantics; role="button" on div alone does not supply native activation behavior. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The div with button role reports; a native button without an explicit role is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yPreferTagOverRoleRejectsDivButton owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yPreferTagOverRoleRejectsDivButton(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/prefer-tag-over-role", `const Component = () => <div role="button" />;`, "native")
  assertJsxA11yRuleSkips(t, "jsx-a11y/prefer-tag-over-role", "declare const props: object; const Component = () => <button />;")
}
