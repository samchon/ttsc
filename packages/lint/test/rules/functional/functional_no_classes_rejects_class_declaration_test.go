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
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies class Store reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The opt-in policy forbids class syntax; a data record has no class declaration. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoClassesRejectsClassDeclaration is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoClassesRejectsClassDeclaration(t *testing.T) {
  const ruleName = "functional/no-classes"
  findings := runFunctionalRule(t, ruleName, `class Store { value = 1; }`)
  assertFunctionalFinding(t, ruleName, findings, "Unexpected class")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const store = { value: 1 };"))
}
