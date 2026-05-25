package linthost

import "testing"

// TestReactJSXNoScriptURLReportsJavascriptHref verifies script URLs in JSX.
//
// The check is string-literal only, matching the high-confidence static case.
//
// 1. Parse an anchor with a javascript: href.
// 2. Enable only `react/jsx-no-script-url`.
// 3. Assert the URL prop is reported.
func TestReactJSXNoScriptURLReportsJavascriptHref(t *testing.T) {
	assertReactRuleFinds(t, "react/jsx-no-script-url", `const C = () => <a href="javascript:alert(1)" />;`, "javascript")
}
