package linthost

import "testing"

// TestFunctionalParametersRejectsRestParameter verifies functional/functional-parameters
// rejects rest parameters by default.
//
// Rest parameters are often used as mutable argument bags. The native policy
// keeps the first slice conservative by flagging the syntax directly without
// needing type information.
//
// 1. Parse a function with a rest parameter.
// 2. Enable only functional/functional-parameters.
// 3. Assert the rest parameter reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies rest items parameter reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations Default functional-parameters policy excludes variadic rest syntax. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalParametersRejectsRestParameter is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalParametersRejectsRestParameter(t *testing.T) {
  const ruleName = "functional/functional-parameters"
  findings := runFunctionalRule(t, ruleName, `function collect(...items: string[]) { return items; }`)
  assertFunctionalFinding(t, ruleName, findings, "rest parameter")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "function collect(items: readonly string[]) { return items; }"))
}
