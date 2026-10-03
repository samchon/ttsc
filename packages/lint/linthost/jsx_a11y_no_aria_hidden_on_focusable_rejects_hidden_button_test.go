package linthost

import "testing"

// TestJsxA11yNoAriaHiddenOnFocusableRejectsHiddenButton verifies focusable nodes are not aria-hidden.
//
// A focused control hidden from the accessibility tree is contradictory. This
// case covers native focusability without requiring tabIndex.
//
// 1. Parse a button with aria-hidden true.
// 2. Enable only `jsx-a11y/no-aria-hidden-on-focusable`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify a native button declaring aria-hidden true is reported; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Changing aria-hidden from true to false removes this explicit hiding marker from the native button. The literal findings follow the static focusability policy without sampling implementation output; actual focus and accessibility-tree exposure are not observed.
// @evidence contracts/testing.md#distinguishing-cases A native button with aria-hidden="true" reports; changing the state to false is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoAriaHiddenOnFocusableRejectsHiddenButton owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoAriaHiddenOnFocusableRejectsHiddenButton(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-aria-hidden-on-focusable", `const Component = () => <button aria-hidden="true">Save</button>;`, "aria-hidden")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-aria-hidden-on-focusable", "declare const props: object; const Component = () => <button aria-hidden=\"false\">Save</button>;")
}
