package linthost

import "testing"

// TestJsxA11yNoNoninteractiveElementInteractionsRejectsLiClick verifies non-interactive elements avoid handlers.
//
// List items have structural semantics, not activation semantics. This rule
// catches direct interaction handlers on those known non-interactive tags.
//
// 1. Parse an li with onClick.
// 2. Enable only `jsx-a11y/no-noninteractive-element-interactions`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify structural li has a click handler; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations An li without a handler keeps structural rather than activation behavior. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The li with onClick reports; removing the handler while preserving Item content is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoNoninteractiveElementInteractionsRejectsLiClick owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoNoninteractiveElementInteractionsRejectsLiClick(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-noninteractive-element-interactions", `const Component = () => <li onClick={() => {}}>Item</li>;`, "Non-interactive")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-noninteractive-element-interactions", "declare const props: object; const Component = () => <li>Item</li>;")
}
