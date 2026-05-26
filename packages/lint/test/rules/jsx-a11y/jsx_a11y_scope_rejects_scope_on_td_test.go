package linthost

import "testing"

// TestJsxA11yScopeRejectsScopeOnTd verifies scope is only accepted on th.
//
// Table scope only describes header cells. This case catches the common td
// spelling error through intrinsic tag inspection.
//
// 1. Parse a td with scope.
// 2. Enable only `jsx-a11y/scope`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yScopeRejectsScopeOnTd(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/scope", `const Component = () => <td scope="col">Value</td>;`, "scope")
}
