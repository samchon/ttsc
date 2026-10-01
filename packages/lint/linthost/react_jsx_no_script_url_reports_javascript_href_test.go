package linthost

import "testing"

// TestReactJSXNoScriptURLReportsJavascriptHref verifies script URLs in JSX.
//
// The check is string-literal only, matching the high-confidence static case.
//
// 1. Parse an anchor with a javascript: href.
// 2. Enable only `react/jsx-no-script-url`.
// 3. Assert the URL prop is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify static javascript href reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations A normal relative URL does not execute the forbidden script scheme.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXNoScriptURLReportsJavascriptHref is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXNoScriptURLReportsJavascriptHref(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-no-script-url", `const C = () => <a href="javascript:alert(1)" />;`, "javascript")
  assertReactRuleSkips(t, "react/jsx-no-script-url", "const C = () => <a href=\"/profile\" />;")
}
