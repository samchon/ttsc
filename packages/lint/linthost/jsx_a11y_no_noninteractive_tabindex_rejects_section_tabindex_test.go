package linthost

import "testing"

// TestJsxA11yNoNoninteractiveTabindexRejectsSectionTabindex verifies tabIndex is limited to interactive elements.
//
// Focus order should not include static regions unless they have interactive
// semantics. This case covers numeric JSX expression values.
//
// 1. Parse a section with tabIndex 0.
// 2. Enable only `jsx-a11y/no-noninteractive-tabindex`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify section tabIndex zero is reported; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Removing tabIndex keeps the region outside interactive focus order. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases A section with tabIndex={0} reports; the same section without tabIndex is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoNoninteractiveTabindexRejectsSectionTabindex owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoNoninteractiveTabindexRejectsSectionTabindex(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-noninteractive-tabindex", `const Component = () => <section tabIndex={0} />;`, "tabIndex")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-noninteractive-tabindex", "declare const props: object; const Component = () => <section />;")
}
