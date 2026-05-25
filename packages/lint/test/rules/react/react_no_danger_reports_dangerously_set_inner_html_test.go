package linthost

import "testing"

// TestReactNoDangerReportsDangerouslySetInnerHTML verifies raw HTML injection.
//
// The rule catches the explicit React escape hatch without trying to reason
// about sanitization.
//
// 1. Parse a JSX element with dangerouslySetInnerHTML.
// 2. Enable only `react/no-danger`.
// 3. Assert the prop is reported.
func TestReactNoDangerReportsDangerouslySetInnerHTML(t *testing.T) {
	assertReactRuleFinds(t, "react/no-danger", `const C = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;`, "dangerouslySetInnerHTML")
}
