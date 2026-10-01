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
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies single-argument Number forwarding wrapper reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The policy prefers the directly referenced callee over a trivial forwarding arrow. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The positive case `const parse = (value) => Number(value);` must report once, and the adjacent negative case `const parse = Number;` (no arrow wrapper) must produce zero findings; wrappers with member callees, typed parameters or multiple arguments are not exercised here.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferTacitRejectsSingleArgumentWrapper is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferTacitRejectsSingleArgumentWrapper(t *testing.T) {
  const ruleName = "functional/prefer-tacit"
  findings := runFunctionalRule(t, ruleName, `const parse = (value) => Number(value);`)
  assertFunctionalFinding(t, ruleName, findings, "wrapper")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const parse = Number;"))
}
