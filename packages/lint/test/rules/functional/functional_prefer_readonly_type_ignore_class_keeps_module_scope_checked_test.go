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
