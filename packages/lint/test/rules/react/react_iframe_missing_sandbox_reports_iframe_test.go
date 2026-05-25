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
func TestReactIframeMissingSandboxReportsIframe(t *testing.T) {
	assertReactRuleFinds(t, "react/iframe-missing-sandbox", `const C = () => <iframe src="https://example.com" />;`, "sandbox")
}
