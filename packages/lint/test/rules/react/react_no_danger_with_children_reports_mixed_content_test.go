package linthost

import "testing"

// TestReactNoDangerWithChildrenReportsMixedContent verifies dangerous HTML
// injection is not combined with normal children.
//
// React ignores children when dangerouslySetInnerHTML is present, so keeping
// both in source is contradictory.
//
// 1. Parse a JSX element with dangerous HTML and text children.
// 2. Enable only `react/no-danger-with-children`.
// 3. Assert the dangerous prop is reported.
func TestReactNoDangerWithChildrenReportsMixedContent(t *testing.T) {
	assertReactRuleFinds(t, "react/no-danger-with-children", `const C = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }}>fallback</div>;`, "children")
}
