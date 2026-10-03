package linthost

import "testing"

// TestJsxA11yNoAccessKeyRejectsAccessKey verifies accessKey is rejected.
//
// Keyboard shortcut conflicts are global and hard to predict, so the JSX
// attribute itself is enough to diagnose the issue.
//
// 1. Parse a button with accessKey.
// 2. Enable only `jsx-a11y/no-access-key`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify the disallowed accessKey attribute is reported; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A button without accessKey avoids that shortcut assignment. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases A Save button with accessKey="s" reports; removing only that shortcut attribute is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoAccessKeyRejectsAccessKey owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoAccessKeyRejectsAccessKey(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-access-key", `const Component = () => <button accessKey="s">Save</button>;`, "accessKey")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-access-key", "declare const props: object; const Component = () => <button>Save</button>;")
}
