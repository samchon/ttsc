package linthost

import "testing"

// TestFunctionalNoPromiseRejectRejectsStaticCall verifies functional/no-promise-reject rejects Promise.reject.
//
// Rejected promises encode exceptional control flow. The native rule pins the
// common static call form before broader promise-flow analysis exists.
//
// 1. Parse a Promise.reject call.
// 2. Enable only functional/no-promise-reject.
// 3. Assert the call reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies Promise.reject reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy excludes rejected-promise control flow, not Promise.resolve. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoPromiseRejectRejectsStaticCall is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoPromiseRejectRejectsStaticCall(t *testing.T) {
  const ruleName = "functional/no-promise-reject"
  findings := runFunctionalRule(t, ruleName, `Promise.reject(error);`)
  assertFunctionalFinding(t, ruleName, findings, "rejection")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "Promise.resolve(value);"))
}
