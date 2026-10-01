package linthost

import "testing"

// TestFunctionalNoLetIgnoresIdentifierPattern verifies functional/no-let honors ignoreIdentifierPattern.
//
// The public rule options expose identifier-pattern skips for functional rules.
// This pins the native decoder path so a configured binding-name exception does
// not still report the shared `let` keyword.
//
// 1. Parse a `let` declaration whose binding name matches the configured pattern.
// 2. Enable only functional/no-let with `ignoreIdentifierPattern`.
// 3. Assert the declaration is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutableValue let is accepted with its name pattern; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The exact identifier-pattern exemption selects this binding. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases NoLetRejectsLetDeclaration owns the unconfigured rejection.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoLetIgnoresIdentifierPattern is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoLetIgnoresIdentifierPattern(t *testing.T) {
  const ruleName = "functional/no-let"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    `let mutableValue = 1;`,
    `{"ignoreIdentifierPattern":"^mutableValue$"}`,
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
