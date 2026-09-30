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
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify raw HTML combined with text children reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations A raw-HTML element without simultaneous JSX children removes the contradictory ownership.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoDangerWithChildrenReportsMixedContent is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoDangerWithChildrenReportsMixedContent(t *testing.T) {
  assertReactRuleFinds(t, "react/no-danger-with-children", `const C = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }}>fallback</div>;`, "children")
  assertReactRuleSkips(t, "react/no-danger-with-children", "const C = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;")
}
