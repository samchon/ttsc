package linthost

import "testing"

// TestReactNoStringRefsReportsStringRef verifies string refs are rejected.
//
// String refs are legacy React API and the literal prop is trivial to detect.
//
// 1. Parse an input with ref="name".
// 2. Enable only `react/no-string-refs`.
// 3. Assert the ref prop is reported.
func TestReactNoStringRefsReportsStringRef(t *testing.T) {
	assertReactRuleFinds(t, "react/no-string-refs", `const C = () => <input ref="name" />;`, "String refs")
}
