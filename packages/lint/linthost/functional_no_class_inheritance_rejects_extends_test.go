package linthost

import "testing"

// TestFunctionalNoClassInheritanceRejectsExtends verifies
// functional/no-class-inheritance rejects `extends` clauses.
//
// The rule is narrower than functional/no-classes: projects can ban inheritance
// while still temporarily allowing class declarations during migration.
//
// 1. Parse a base class and a subclass.
// 2. Enable only functional/no-class-inheritance.
// 3. Assert the subclass inheritance reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies only Child extends Base reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The inheritance policy is narrower than the class policy; a class without extends is accepted. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases Positive: `class Base {} class Child extends Base {}` must yield exactly one functional/no-class-inheritance finding (assertFunctionalFinding). Negative control run through the same rule via assertNoFunctionalFinding: `class Store { value = 1; }` must yield zero findings; a class declaration without an extends clause is accepted, so only the inheriting class Child is reported. No option-configured variant is exercised here.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoClassInheritanceRejectsExtends is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoClassInheritanceRejectsExtends(t *testing.T) {
  const ruleName = "functional/no-class-inheritance"
  findings := runFunctionalRule(t, ruleName, `class Base {} class Child extends Base {}`)
  assertFunctionalFinding(t, ruleName, findings, "inheritance")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "class Store { value = 1; }"))
}
