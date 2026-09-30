package linthost

import "testing"

// TestFunctionalPreferTacitRejectsSingleArgumentWrapper verifies functional/prefer-tacit rejects needless wrappers.
//
// A single-argument arrow that only forwards into another call is the safest
// point-free style candidate and avoids semantic changes from arity-sensitive functions.
//
// 1. Parse a forwarding arrow function.
// 2. Enable only functional/prefer-tacit.
// 3. Assert the arrow reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies single-argument Number forwarding wrapper reports; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy prefers the directly referenced callee over a trivial forwarding arrow. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferTacitRejectsSingleArgumentWrapper is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferTacitRejectsSingleArgumentWrapper(t *testing.T) {
  const ruleName = "functional/prefer-tacit"
  findings := runFunctionalRule(t, ruleName, `const parse = (value) => Number(value);`)
  assertFunctionalFinding(t, ruleName, findings, "wrapper")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const parse = Number;"))
}
