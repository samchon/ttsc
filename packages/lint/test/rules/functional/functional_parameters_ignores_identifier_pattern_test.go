package linthost

import "testing"

// TestFunctionalParametersIgnoresIdentifierPattern verifies functional/functional-parameters.
//
// Rest-parameter diagnostics are anchored to the parameter node. This pins the
// shared identifier-pattern skip for the functional parameter option decoder.
//
// 1. Parse a rest parameter whose name matches the configured pattern.
// 2. Enable only functional/functional-parameters with `ignoreIdentifierPattern`.
// 3. Assert the parameter is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies rest items parameter stays accepted under its name exemption; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations ignoreIdentifierPattern applies to the reported parameter binding. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases ParametersRejectsRestParameter owns the same source with default policy.
// @evidence contracts/testing.md#execution-ownership TestFunctionalParametersIgnoresIdentifierPattern is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalParametersIgnoresIdentifierPattern(t *testing.T) {
  const ruleName = "functional/functional-parameters"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    `function collect(...items: string[]) { return items; }`,
    `{"ignoreIdentifierPattern":"^items$"}`,
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
