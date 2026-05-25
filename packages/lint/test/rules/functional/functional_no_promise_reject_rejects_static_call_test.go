package linthost

import "testing"

// TestFunctionalNoPromiseRejectRejectsStaticCall verifies functional/no-promise-reject rejects Promise.reject.
//
// Rejected promises encode exceptional control flow. The native rule pins the
// common static call form before broader promise-flow analysis exists.
//
// 1. Parse a Promise.reject call.
// 2. Enable only functional/no-promise-reject.
// 3. Assert the call reports and offers no autofix.
func TestFunctionalNoPromiseRejectRejectsStaticCall(t *testing.T) {
	const ruleName = "functional/no-promise-reject"
	findings := runFunctionalRule(t, ruleName, `Promise.reject(error);`)
	assertFunctionalFinding(t, ruleName, findings, "rejection")
}
