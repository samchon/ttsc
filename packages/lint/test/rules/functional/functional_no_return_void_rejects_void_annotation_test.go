package linthost

import "testing"

// TestFunctionalNoReturnVoidRejectsVoidAnnotation verifies functional/no-return-void rejects void functions.
//
// Void return types are side-effect oriented. This test pins the declaration
// return-type branch independent of return statement traversal.
//
// 1. Parse a function annotated as void.
// 2. Enable only functional/no-return-void.
// 3. Assert the function reports and offers no autofix.
func TestFunctionalNoReturnVoidRejectsVoidAnnotation(t *testing.T) {
	const ruleName = "functional/no-return-void"
	findings := runFunctionalRule(t, ruleName, `function run(): void {}`)
	assertFunctionalFinding(t, ruleName, findings, "return")
}
