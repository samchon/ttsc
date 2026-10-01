package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentAcceptsParenthesizedJestInlineSnapshot verifies that the engine requires one ordinary rule error for the retained parenthesized expect and template call.
//
// Parentheses do not change the supported direct call meaning; the authored selected multiline template independently requires a report.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The engine requires one ordinary rule error for the retained parenthesized expect and template call.
// @evidence contracts/testing.md#independent-expectations Parentheses do not change the supported direct call meaning; the authored selected multiline template independently requires a report.
// @evidence contracts/testing.md#distinguishing-cases Both expect callee and template argument are parenthesized; the near-miss host owns true call-shape exclusions.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentAcceptsParenthesizedJestInlineSnapshot owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentAcceptsParenthesizedJestInlineSnapshot(t *testing.T) {
  source := "declare const value: unknown;\n" +
    "(expect)(value).toMatchInlineSnapshot((`\nsnapshot\n`));\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornTemplateIndentRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("parenthesized Jest inline snapshot must be selected, got %+v", findings)
  }
}
