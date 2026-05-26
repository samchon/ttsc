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
func TestJsxA11yNoAccessKeyRejectsAccessKey(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-access-key", `const Component = () => <button accessKey="s">Save</button>;`, "accessKey")
}
