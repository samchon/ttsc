package linthost

import "testing"

// TestFunctionalNoThisExpressionsRejectsThis verifies functional/no-this-expressions rejects this.
//
// `this` binds behavior to ambient object state. The rule reports the keyword
// directly so class and object-method cases share one AST path.
//
// 1. Parse a this expression.
// 2. Enable only functional/no-this-expressions.
// 3. Assert the expression reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies this.value reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy rejects ambient object receiver state, not explicit inputs. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoThisExpressionsRejectsThis is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoThisExpressionsRejectsThis(t *testing.T) {
  const ruleName = "functional/no-this-expressions"
  findings := runFunctionalRule(t, ruleName, `this.value;`)
  assertFunctionalFinding(t, ruleName, findings, "this")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const result = value;"))
}
