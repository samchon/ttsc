package linthost

import (
  "testing"
)

const switchCaseBreakPositionRule = "unicorn/switch-case-break-position"

// TestRuleCorpusUnicornSwitchCaseBreakPosition keeps the public TypeScript
// corpus fixture connected to a real behavioral witness. The diagnostic is on
// the direct break after the clause's sole non-empty block.
// TestRuleCorpusUnicornSwitchCaseBreakPosition verifies the corpus reports a terminator outside its sole block.
//
// The supported direct-terminator placement policy independently establishes the literal annotated finding.
//
// 1. Execute the retained clause or command fixture through the owning Go operation.
// 2. Compare the authored report, edit or preserved-file result for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run compares the annotated switch clause with its supported terminator-placement diagnostic.
// @evidence contracts/testing.md#independent-expectations The supported direct-terminator placement policy independently establishes the literal annotated finding.
// @evidence contracts/testing.md#distinguishing-cases The original nonempty block followed by break owns the corpus report; structural no-report counterparts belong to RequiresSoleNonEmptyBlockThenDirectTerminator.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornSwitchCaseBreakPosition owns these literal cases as a discoverable Go unit entry, retaining named subcase identities where present; actual engine/fix/command functions run in the shared process with isolated fixture files, without installation, native producer or product child host.
func TestRuleCorpusUnicornSwitchCaseBreakPosition(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/switch-case-break-position.ts", `declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  // expect: unicorn/switch-case-break-position error
  break;
}
`)
}





