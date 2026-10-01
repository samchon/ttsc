package linthost

import "testing"

// TestFunctionalImmutableDataRejectsPropertyAssignment verifies
// functional/immutable-data rejects writes through object properties.
//
// Property assignment is the core mutation shape this policy must catch before
// broader collection helpers matter, and it is AST-local enough to enforce
// without checker state.
//
// 1. Parse an assignment to `state.count`.
// 2. Enable only functional/immutable-data.
// 3. Assert the property write reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies state.count write reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations Immutable data policy rejects member writes but allows reading the property. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalImmutableDataRejectsPropertyAssignment is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalImmutableDataRejectsPropertyAssignment(t *testing.T) {
  const ruleName = "functional/immutable-data"
  findings := runFunctionalRule(t, ruleName, `const state = { count: 0 }; state.count = 1;`)
  assertFunctionalFinding(t, ruleName, findings, "Modifying")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const state = { count: 0 }; const current = state.count;"))
}
