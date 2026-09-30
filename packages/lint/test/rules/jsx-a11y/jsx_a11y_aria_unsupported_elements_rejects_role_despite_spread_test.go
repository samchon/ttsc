package linthost

import "testing"

// TestJsxA11yAriaUnsupportedElementsRejectsRoleDespiteSpread verifies spreads
// do not suppress explicit roles on unsupported elements.
//
// aria-unsupported-elements judges explicitly written role/aria-* attributes
// on meta/html/script/style, so a sibling spread changes nothing about the
// violation. Pins the presence-predicated side of the spread handling and the
// no-panic attribute walk.
//
// 1. Parse a meta element with an explicit role plus a spread.
// 2. Enable only `jsx-a11y/aria-unsupported-elements`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify explicit meta role remains invalid beside a spread; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Removing explicit role leaves no unsupported semantic declaration for the unknown spread. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Explicit role="none" on meta reports despite a spread; removing that role while retaining meta and the spread is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAriaUnsupportedElementsRejectsRoleDespiteSpread owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAriaUnsupportedElementsRejectsRoleDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-unsupported-elements", `declare const props: object; const Component = () => <meta charSet="utf-8" role="none" {...props} />;`, "ARIA roles")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-unsupported-elements", "declare const props: object; const Component = () => <meta charSet=\"utf-8\" {...props} />;")
}
