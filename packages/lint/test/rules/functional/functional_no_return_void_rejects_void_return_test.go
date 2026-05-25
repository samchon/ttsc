package linthost

import "testing"

// TestFunctionalNoReturnVoidRejectsVoidReturn verifies functional/no-return-void
// rejects functions explicitly typed as `void`.
//
// Functional APIs should produce values. An explicit `void` return annotation is
// a stable AST-local signal that a function is effect-only.
//
// 1. Parse a function with a `void` return type.
// 2. Enable only functional/no-return-void.
// 3. Assert the function reports and offers no autofix.
func TestFunctionalNoReturnVoidRejectsVoidReturn(t *testing.T) {
	const ruleName = "functional/no-return-void"
	findings := runFunctionalRule(t, ruleName, `function log(): void { return; }`)
	assertFunctionalFinding(t, ruleName, findings, "return a value")
}
