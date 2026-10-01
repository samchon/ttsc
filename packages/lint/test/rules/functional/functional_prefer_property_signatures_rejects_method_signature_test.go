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
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies interface method signature reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy prefers an explicit function-valued property signature. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferPropertySignaturesRejectsMethodSignature is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferPropertySignaturesRejectsMethodSignature(t *testing.T) {
  const ruleName = "functional/prefer-property-signatures"
  findings := runFunctionalRule(t, ruleName, `interface Api { run(): void; }`)
  assertFunctionalFinding(t, ruleName, findings, "property signature")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "interface Api { run: () => void; }"))
}
