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
//
// @evidence contracts/testing.md#behavioral-verification The middleware ordering rule reports methodOverride after csrf but not the earlier methodOverride call.
// @evidence contracts/testing.md#independent-expectations The literal call sequence establishes which middleware ran first; the marker encodes the contract that rewriting the HTTP method after CSRF checking is unsafe.
// @evidence contracts/testing.md#distinguishing-cases Contains methodOverride both before and after csrf, so a rule matching the method name without tracking ordering fails.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectNoCSRFBeforeMethodOverride(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-no-csrf-before-method-override.ts", `
express.methodOverride();
express.csrf();
// expect: security/detect-no-csrf-before-method-override error
express.methodOverride();
`)
}
