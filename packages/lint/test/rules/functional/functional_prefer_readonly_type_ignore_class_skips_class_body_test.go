package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreClassSkipsClassBody verifies functional/prefer-readonly-type honors ignoreClass: true.
//
// The rule dispatches by node kind with no scope filter, so a mutable type
// inside a class body reports like any other. `ignoreClass` was published as the
// way to turn that off and decoded nothing, and its first reserved note wrongly
// claimed the rule visits no class-member position.
//
// 1. Parse a class with a mutable array field and a mutable array parameter.
// 2. Enable only functional/prefer-readonly-type with `ignoreClass: true`.
// 3. Assert the whole class body is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies mutable field and method parameter stay accepted with ignoreClass true; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The boolean class exemption includes the entire class body. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases FieldsOnlyKeepsMethodParameter and KeepsModuleScopeChecked own the narrower/outside distinctions.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoreClassSkipsClassBody is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeIgnoreClassSkipsClassBody(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "class A {\n  values: string[] = [];\n  run(items: string[]): void {}\n}",
    "{\"ignoreClass\":true}",
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
