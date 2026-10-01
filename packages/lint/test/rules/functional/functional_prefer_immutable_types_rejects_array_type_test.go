package linthost

import "testing"

// TestFunctionalPreferImmutableTypesRejectsArrayType verifies functional/prefer-immutable-types rejects mutable types.
//
// Mutable array annotations are the most common type-level mutability leak. The
// rule reports the annotation without requiring checker expansion.
//
// 1. Parse a mutable array type annotation.
// 2. Enable only functional/prefer-immutable-types.
// 3. Assert the annotation reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies mutable variable array annotation reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations readonly array syntax expresses the required immutable declaration type. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferImmutableTypesRejectsArrayType is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferImmutableTypesRejectsArrayType(t *testing.T) {
  const ruleName = "functional/prefer-immutable-types"
  findings := runFunctionalRule(t, ruleName, `const values: string[] = [];`)
  assertFunctionalFinding(t, ruleName, findings, "readonly")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const values: readonly string[] = [];"))
}
