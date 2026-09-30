package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreClassKeepsModuleScopeChecked verifies
// ignoreClass leaves everything outside a class checked.
//
// The two positive cases both live inside a class, so a position test that
// answered "in a class" unconditionally would satisfy both of them and silence
// the whole rule. This is the case that fails on that mistake.
//
// 1. Parse a module-scope mutable array type alias.
// 2. Enable only functional/prefer-readonly-type with `ignoreClass: true`.
// 3. Assert the alias still reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable module alias still reports with ignoreClass true; exact count/rule/message and no-autofix assertions distinguish policy reports from unrelated findings.
// @evidence contracts/testing.md#independent-expectations A class-only exemption cannot suppress module-scope types. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreClassSkipsClassBody owns accepted class members. This case owns its explicit source/option distinction rather than certifying the whole family.
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
