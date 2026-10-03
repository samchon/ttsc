package linthost

import "testing"

// TestJsxA11yTabindexNoPositiveRejectsPositiveTabindex verifies positive tabIndex is rejected.
//
// Positive tabIndex creates a custom focus order. This test covers numeric JSX
// expression extraction for camel-case `tabIndex`.
//
// 1. Parse a div with tabIndex 2.
// 2. Enable only `jsx-a11y/tabindex-no-positive`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify a positive tabIndex value is reported; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Zero stays in normal sequential focus ordering. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases tabIndex={2} reports; zero on the same div is the accepted ordering boundary.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yTabindexNoPositiveRejectsPositiveTabindex owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yTabindexNoPositiveRejectsPositiveTabindex(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/tabindex-no-positive", `const Component = () => <div tabIndex={2} />;`, "tabIndex")
  assertJsxA11yRuleSkips(t, "jsx-a11y/tabindex-no-positive", "declare const props: object; const Component = () => <div tabIndex={0} />;")
}
