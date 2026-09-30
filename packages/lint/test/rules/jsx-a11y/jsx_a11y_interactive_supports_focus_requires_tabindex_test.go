package linthost

import "testing"

// TestJsxA11yInteractiveSupportsFocusRequiresTabindex verifies interactive roles need focus.
//
// A custom element with role button must be reachable by keyboard. This case
// locks the explicit-role path separate from native button handling.
//
// 1. Parse a div with role button and no tabIndex.
// 2. Enable only `jsx-a11y/interactive-supports-focus`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify button-role div is not focusable; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations tabIndex zero supplies keyboard focus for this explicit interactive role. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases A button-role div without tabIndex reports; adding tabIndex={0} is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yInteractiveSupportsFocusRequiresTabindex owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yInteractiveSupportsFocusRequiresTabindex(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/interactive-supports-focus", `const Component = () => <div role="button" />;`, "focusable")
  assertJsxA11yRuleSkips(t, "jsx-a11y/interactive-supports-focus", "declare const props: object; const Component = () => <div role=\"button\" tabIndex={0} />;")
}
