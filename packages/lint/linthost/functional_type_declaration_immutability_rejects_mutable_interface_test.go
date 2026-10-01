package linthost

import "testing"

// TestFunctionalTypeDeclarationImmutabilityRejectsMutableInterface verifies functional/type-declaration-immutability.
//
// Public type declarations are the policy boundary for immutable data. A mutable
// interface property should be reported even when no implementation code exists.
//
// 1. Parse an interface with a mutable property.
// 2. Enable only functional/type-declaration-immutability.
// 3. Assert the declaration reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies mutable State property reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations Public declaration policy requires readonly members and readonly array contents. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The positive case `interface State { values: string[]; }` must report once, and the adjacent negative case `interface State { readonly values: readonly string[]; }` must produce zero findings; option-driven exemptions are owned by IgnoresIdentifierPattern.
// @evidence contracts/testing.md#execution-ownership TestFunctionalTypeDeclarationImmutabilityRejectsMutableInterface is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalTypeDeclarationImmutabilityRejectsMutableInterface(t *testing.T) {
  const ruleName = "functional/type-declaration-immutability"
  findings := runFunctionalRule(t, ruleName, `interface State { values: string[]; }`)
  assertFunctionalFinding(t, ruleName, findings, "readonly")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "interface State { readonly values: readonly string[]; }"))
}
