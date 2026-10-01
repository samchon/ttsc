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
// @evidence contracts/testing.md#behavioral-verification runFunctionalRule executes the actual engine and verifies let declaration reports despite subsequent assignment; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations The declaration policy rejects mutability even where prefer-const would not apply. The authored source states the policy case independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases Positive: `let value = 1; value = 2;` must yield exactly one functional/no-let finding (assertFunctionalFinding). Negative control run through the same rule via assertNoFunctionalFinding: `const value = 1;` must yield zero findings; a const declaration is accepted. No option-configured variant is exercised here.
// @evidence contracts/testing.md#execution-ownership TestFunctionalNoLetRejectsLetDeclaration is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalNoLetRejectsLetDeclaration(t *testing.T) {
  const ruleName = "functional/no-let"
  findings := runFunctionalRule(t, ruleName, `let value = 1; value = 2;`)
  assertFunctionalFinding(t, ruleName, findings, "Unexpected let")
  assertNoFunctionalFinding(t, ruleName, runFunctionalRule(t, ruleName, "const value = 1;"))
}
