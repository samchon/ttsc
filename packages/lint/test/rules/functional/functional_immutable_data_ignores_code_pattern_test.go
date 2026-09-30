package linthost

import "testing"

// TestFunctionalImmutableDataIgnoresCodePattern verifies functional/immutable-data honors ignoreCodePattern.
//
// The mutation rule reports member-access nodes instead of declarations, so the
// source-code pattern skip is the compatible escape hatch for generated or
// framework-owned write sites.
//
// 1. Parse a property assignment that the rule normally rejects.
// 2. Enable only functional/immutable-data with a matching `ignoreCodePattern`.
// 3. Assert the mutation is skipped.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies state.count write is accepted under a matching code pattern; an exact zero-finding comparison rejects both unwanted reports and recovered engine failures.
// @evidence contracts/testing.md#independent-expectations The published ignoreCodePattern exempts this exact write expression. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The default rejection is owned by ImmutableDataRejectsPropertyAssignment. This case owns its explicit source/option distinction rather than certifying the whole family.
// @evidence contracts/testing.md#execution-ownership TestFunctionalImmutableDataIgnoresCodePattern is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalImmutableDataIgnoresCodePattern(t *testing.T) {
  const ruleName = "functional/immutable-data"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    `const state = { count: 0 }; state.count = 1;`,
    `{"ignoreCodePattern":["state\\.count"]}`,
  )
  assertNoFunctionalFinding(t, ruleName, findings)
}
