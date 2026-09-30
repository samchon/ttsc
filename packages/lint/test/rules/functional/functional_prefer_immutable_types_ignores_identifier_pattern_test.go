package linthost

import "testing"

// TestFunctionalPreferImmutableTypesIgnoresIdentifierPattern verifies functional/prefer-immutable-types.
//
// The rule reports the mutable type node, but users configure identifier
// patterns against the surrounding declaration name. This keeps that bridge
// covered for declaration-based immutable-type checks.
//
// 1. Parse a mutable array annotation on a matching variable declaration.
// 2. Enable only functional/prefer-immutable-types with `ignoreIdentifierPattern`.
// 3. Assert the type is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutableValues array annotation is accepted under its declaration-name exemption; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The option refers to the owning declaration identifier despite the reported type node. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases PreferImmutableTypesRejectsArrayType owns the default mutable annotation. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferImmutableTypesIgnoresIdentifierPattern is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferImmutableTypesIgnoresIdentifierPattern(t *testing.T) {
  const ruleName = "functional/prefer-immutable-types"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    `const mutableValues: string[] = [];`,
    `{"ignoreIdentifierPattern":"^mutableValues$"}`,
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
