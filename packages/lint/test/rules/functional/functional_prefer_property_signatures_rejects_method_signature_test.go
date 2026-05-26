package linthost

import "testing"

// TestFunctionalPreferPropertySignaturesRejectsMethodSignature verifies functional/prefer-property-signatures.
//
// Function-valued properties are easier to model as immutable data than method
// shorthand signatures. This pins the interface method-signature branch.
//
// 1. Parse an interface method signature.
// 2. Enable only functional/prefer-property-signatures.
// 3. Assert the method signature reports and offers no autofix.
func TestFunctionalPreferPropertySignaturesRejectsMethodSignature(t *testing.T) {
	const ruleName = "functional/prefer-property-signatures"
	findings := runFunctionalRule(t, ruleName, `interface Api { run(): void; }`)
	assertFunctionalFinding(t, ruleName, findings, "property signature")
}
