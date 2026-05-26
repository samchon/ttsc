package linthost

import "testing"

// TestRuleCorpusPromiseSpecOnly verifies promise/spec-only reports
// non-standard Promise statics.
//
// The standard static set is intentionally small and mirrors the ECMAScript
// Promise API surface.
//
// 1. Enable promise/spec-only.
// 2. Access a non-standard Promise.delay method.
// 3. Assert the property access is reported.
func TestRuleCorpusPromiseSpecOnly(t *testing.T) {
	assertRuleCorpusCase(t, "promise/spec-only.ts", "// expect: promise/spec-only error\nPromise.delay(1);\n")
}
