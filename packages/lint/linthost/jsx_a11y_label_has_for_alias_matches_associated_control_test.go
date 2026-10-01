package linthost

import "testing"

// TestJsxA11yLabelHasForAliasMatchesAssociatedControl verifies the legacy label rule aliases behavior.
//
// `label-has-for` is retained for compatibility with eslint-plugin-jsx-a11y
// configurations and should report the same static missing-association case.
//
// 1. Parse a label with no htmlFor/for and no nested control.
// 2. Enable only `jsx-a11y/label-has-for`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify legacy label-has-for alias reports missing association; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The compatibility alias accepts the same explicit association. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The label-has-for alias rejects an unassociated Email label; adding htmlFor="email" is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yLabelHasForAliasMatchesAssociatedControl owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yLabelHasForAliasMatchesAssociatedControl(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/label-has-for", `const Component = () => <label>Email</label>;`, "control")
  assertJsxA11yRuleSkips(t, "jsx-a11y/label-has-for", "declare const props: object; const Component = () => <label htmlFor=\"email\">Email</label>;")
}
