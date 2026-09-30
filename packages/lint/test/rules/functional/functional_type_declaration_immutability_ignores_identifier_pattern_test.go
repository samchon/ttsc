package linthost

import "testing"

// TestFunctionalTypeDeclarationImmutabilityIgnoresIdentifierPattern verifies functional/type-declaration-immutability.
//
// Type declarations already have name-scoped `rules`; this locks the shared
// `ignoreIdentifierPattern` path layered over that local policy surface.
//
// 1. Parse a mutable interface whose name matches the configured ignore pattern.
// 2. Enable only functional/type-declaration-immutability with `ignoreIdentifierPattern`.
// 3. Assert the declaration is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies MutableSnapshot interface stays accepted under its name exemption; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The declaration-name pattern exempts this authored interface from immutability policy. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases TypeDeclarationImmutabilityRejectsMutableInterface owns the default rejection. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalTypeDeclarationImmutabilityIgnoresIdentifierPattern is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalTypeDeclarationImmutabilityIgnoresIdentifierPattern(t *testing.T) {
  const ruleName = "functional/type-declaration-immutability"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    `interface MutableSnapshot { value: string[]; }`,
    `{"ignoreIdentifierPattern":"^MutableSnapshot$"}`,
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
