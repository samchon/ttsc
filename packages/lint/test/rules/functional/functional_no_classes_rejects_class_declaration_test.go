package linthost

import "testing"

// TestFunctionalNoClassesRejectsClassDeclaration verifies functional/no-classes
// rejects class declarations.
//
// Classes introduce identity and `this` state; the opt-in functional pack needs
// a direct syntax gate that does not depend on inheritance or member analysis.
//
// 1. Parse a class declaration.
// 2. Enable only functional/no-classes.
// 3. Assert the class reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies class Store reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The opt-in policy forbids class syntax; a data record has no class declaration. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoClassesRejectsClassDeclaration is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoClassesRejectsClassDeclaration(t *testing.T) {
  const ruleName = "functional/no-classes"
  findings := runFunctionalRule(t, ruleName, `class Store { value = 1; }`)
  assertFunctionalFinding(t, ruleName, findings, "Unexpected class")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const store = { value: 1 };"))
}
