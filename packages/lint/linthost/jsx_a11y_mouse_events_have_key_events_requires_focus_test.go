package linthost

import "testing"

// TestJsxA11yMouseEventsHaveKeyEventsRequiresFocus verifies mouseover has focus parity.
//
// Hover-only behavior excludes keyboard users. This case locks the sibling
// handler check for onMouseOver and onFocus.
//
// 1. Parse a div with onMouseOver and no onFocus.
// 2. Enable only `jsx-a11y/mouse-events-have-key-events`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify mouseover has no corresponding focus event; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations onFocus is the supported static focus-handler counterpart for this hover-handler policy; the test does not execute browser interaction. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The div with only onMouseOver reports; adding onFocus while retaining the mouse handler is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yMouseEventsHaveKeyEventsRequiresFocus owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yMouseEventsHaveKeyEventsRequiresFocus(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/mouse-events-have-key-events", `const Component = () => <div onMouseOver={() => {}} />;`, "onFocus")
  assertJsxA11yRuleSkips(t, "jsx-a11y/mouse-events-have-key-events", "declare const props: object; const Component = () => <div onMouseOver={() => {}} onFocus={() => {}} />;")
}
