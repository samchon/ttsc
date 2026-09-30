package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentFallsBackToTwoSpacesWithoutAnyIndentSignal verifies that the actual fixer compares the no-signal source with the authored two-space result and requires clean re-lint.
//
// The supported default fallback independently supplies two spaces when source/template indentation offers no signal.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer compares the no-signal source with the authored two-space result and requires clean re-lint.
// @evidence contracts/testing.md#independent-expectations The supported default fallback independently supplies two spaces when source/template indentation offers no signal.
// @evidence contracts/testing.md#distinguishing-cases The unindented two-line body must change to two spaces; surrounding-tab and explicit-option hosts supply other policies.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentFallsBackToTwoSpacesWithoutAnyIndentSignal owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentFallsBackToTwoSpacesWithoutAnyIndentSignal(t *testing.T) {
  source := "const query = gql`\none\ntwo\n`;\n"
  expected := "const query = gql`\n  one\n  two\n`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
