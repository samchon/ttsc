package linthost

import "testing"

// TestJsxA11yAriaUnsupportedElementsRejectsMetaAria verifies inert metadata tags reject ARIA.
//
// Some intrinsic elements cannot expose ARIA semantics. This locks the tag-level
// guard for elements that should not carry role or aria-* attributes.
//
// 1. Parse a meta element with aria-label.
// 2. Enable only `jsx-a11y/aria-unsupported-elements`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify metadata tag exposes aria-label; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A normal div can expose the label whereas metadata cannot. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases meta with aria-label reports; div with the same description label is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAriaUnsupportedElementsRejectsMetaAria owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAriaUnsupportedElementsRejectsMetaAria(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-unsupported-elements", `const Component = () => <meta aria-label="description" />;`, "ARIA")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-unsupported-elements", "declare const props: object; const Component = () => <div aria-label=\"description\" />;")
}
