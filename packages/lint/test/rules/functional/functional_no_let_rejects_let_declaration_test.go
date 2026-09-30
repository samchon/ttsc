package linthost

import "testing"

// TestFunctionalNoLetRejectsLetDeclaration verifies functional/no-let rejects
// mutable `let` declarations.
//
// Existing `prefer-const` only catches lets that are never reassigned. The
// functional policy intentionally rejects the declaration form itself.
//
// 1. Parse a `let` declaration.
// 2. Enable only functional/no-let.
// 3. Assert the `let` keyword reports and offers no autofix.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies let declaration reports despite subsequent assignment; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations The declaration policy rejects mutability even where prefer-const would not apply. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original violating input remains intact and a separately authored accepted source is checked for zero findings. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoLetRejectsLetDeclaration is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoLetRejectsLetDeclaration(t *testing.T) {
  const ruleName = "functional/no-let"
  findings := runFunctionalRule(t, ruleName, `let value = 1; value = 2;`)
  assertFunctionalFinding(t, ruleName, findings, "Unexpected let")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const value = 1;"))
}
