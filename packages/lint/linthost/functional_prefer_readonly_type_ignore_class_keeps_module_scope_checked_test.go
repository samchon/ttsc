package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreClassKeepsModuleScopeChecked verifies
// ignoreClass leaves everything outside a class checked.
//
// This reporting alias is outside every class. An unconditional class
// exemption would incorrectly silence it, whereas the configured policy
// must leave this module-scope array annotation checked.
//
// 1. Parse a module-scope mutable array type alias.
// 2. Enable only functional/prefer-readonly-type with `ignoreClass: true`.
// 3. Assert the alias still reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable module alias still reports with ignoreClass true; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a message containing the expected fragment, which separates the policy report from duplicate or unrelated findings.
// @evidence contracts/testing.md#independent-expectations A class-only exemption cannot suppress module-scope types. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreClassSkipsClassBody owns accepted class members.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoreClassKeepsModuleScopeChecked is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeIgnoreClassKeepsModuleScopeChecked(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "type Values = string[];",
    `{"ignoreClass":true}`,
  )
  assertFunctionalFinding(t, ruleName, findings, "readonly")
}
