package linthost

import "testing"

// TestReactJSXNoTargetBlankReportsMissingRel verifies the explicit noreferrer policy.
//
// The rule fires when literal `target="_blank"` is missing a `rel`
// attribute that contains `noreferrer`, the strictest of the two
// recommended tokens. This AST unit does not observe browser opener behavior.
//
// 1. Parse an anchor with target="_blank" and no rel attribute.
// 2. Enable only `react/jsx-no-target-blank`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify external blank-target anchor without rel reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations The noreferrer token prevents the opener exposure required by this rule.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXNoTargetBlankReportsMissingRel is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXNoTargetBlankReportsMissingRel(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-no-target-blank", `const C = () => <a href="https://example.com" target="_blank">open</a>;`, "noreferrer")
  assertReactRuleSkips(t, "react/jsx-no-target-blank", "const C = () => <a href=\"https://example.com\" target=\"_blank\" rel=\"noreferrer\">open</a>;")
}
