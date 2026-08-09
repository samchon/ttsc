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
