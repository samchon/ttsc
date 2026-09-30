package linthost

import "testing"

// TestReactIframeMissingSandboxReportsIframe verifies iframe sandbox coverage.
//
// The rule is intentionally JSX-syntactic: any intrinsic iframe without a
// sandbox attribute is risky regardless of framework.
//
// 1. Parse an iframe without sandbox.
// 2. Enable only `react/iframe-missing-sandbox`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify iframe without sandbox reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations An explicit sandbox property establishes the required frame restriction.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactIframeMissingSandboxReportsIframe is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactIframeMissingSandboxReportsIframe(t *testing.T) {
  assertReactRuleFinds(t, "react/iframe-missing-sandbox", `const C = () => <iframe src="https://example.com" />;`, "sandbox")
  assertReactRuleSkips(t, "react/iframe-missing-sandbox", "const C = () => <iframe sandbox=\"\" src=\"https://example.com\" />;")
}
