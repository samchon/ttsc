package linthost

import "testing"

// TestSecurityDetectNoCSRFBeforeMethodOverride verifies security rule: csrf before methodOverride is rejected.
//
// The ordering matters because method override can rewrite the HTTP verb after
// csrf has already decided a request did not need protection.
//
// 1. Configure `csrf` before `methodOverride`.
// 2. Enable only `security/detect-no-csrf-before-method-override`.
// 3. Assert the later methodOverride call is reported.
func TestSecurityDetectNoCSRFBeforeMethodOverride(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-no-csrf-before-method-override.ts", `
express.methodOverride();
express.csrf();
// expect: security/detect-no-csrf-before-method-override error
express.methodOverride();
`)
}
