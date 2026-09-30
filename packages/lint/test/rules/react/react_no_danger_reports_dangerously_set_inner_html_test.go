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
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify dangerouslySetInnerHTML reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Normal JSX text avoids the explicit raw-HTML escape hatch.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoDangerReportsDangerouslySetInnerHTML is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoDangerReportsDangerouslySetInnerHTML(t *testing.T) {
  assertReactRuleFinds(t, "react/no-danger", `const C = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;`, "dangerouslySetInnerHTML")
  assertReactRuleSkips(t, "react/no-danger", "const C = ({ html }: { html: string }) => <div>{html}</div>;")
}
