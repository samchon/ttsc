package linthost

import "testing"

// TestJsxA11yClickEventsHaveKeyEventsRequiresKeyboardHandler verifies click handlers need keyboard parity.
//
// The rule intentionally skips native interactive elements, so a plain div with
// only onClick exercises the static non-interactive branch.
//
// 1. Parse a div with onClick and no keyboard handler.
// 2. Enable only `jsx-a11y/click-events-have-key-events`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify static div click has no keyboard handler; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations onKeyDown is the supported static keyboard-handler counterpart for this click-handler policy; the test does not execute browser activation. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The div with only onClick reports; adding onKeyDown while retaining the click handler is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yClickEventsHaveKeyEventsRequiresKeyboardHandler owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yClickEventsHaveKeyEventsRequiresKeyboardHandler(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/click-events-have-key-events", `const Component = () => <div onClick={() => {}} />;`, "keyboard")
  assertJsxA11yRuleSkips(t, "jsx-a11y/click-events-have-key-events", "declare const props: object; const Component = () => <div onClick={() => {}} onKeyDown={() => {}} />;")
}
