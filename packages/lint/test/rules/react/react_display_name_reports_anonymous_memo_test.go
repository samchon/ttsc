package linthost

import "testing"

// TestReactDisplayNameReportsAnonymousMemo verifies that an anonymous
// arrow passed directly to `React.memo(...)` — without a surrounding
// named binding — is flagged for missing displayName.
//
// React DevTools and stack traces fall back on the inner function's
// name; when that name is empty and the wrapper is consumed inline,
// the resulting component is unnamed at runtime.
//
// 1. Parse `React.memo(() => <div />)` as a standalone expression.
// 2. Enable only `react/display-name`.
// 3. Assert the wrapper call is reported.
func TestReactDisplayNameReportsAnonymousMemo(t *testing.T) {
	assertReactRuleFinds(t, "react/display-name", `declare const React: { memo: <T>(fn: T) => T };
JSON.stringify(React.memo(() => <div />));`, "display name")
}
