package linthost

import "testing"

// TestReactJSXNoTargetBlankReportsMissingRel verifies tab-nabbing protection.
//
// The rule fires when an opener-exposing `target="_blank"` is missing a `rel`
// attribute that contains `noreferrer`, the strictest of the two
// recommended tokens.
//
// 1. Parse an anchor with target="_blank" and no rel attribute.
// 2. Enable only `react/jsx-no-target-blank`.
// 3. Assert one diagnostic is reported.
func TestReactJSXNoTargetBlankReportsMissingRel(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-no-target-blank", `const C = () => <a href="https://example.com" target="_blank">open</a>;`, "noreferrer")
}
