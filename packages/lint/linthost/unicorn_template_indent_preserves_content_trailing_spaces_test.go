package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentPreservesContentTrailingSpaces verifies that the fixer compares exact authored output and requires clean re-lint without deleting content trailing spaces.
//
// The supported transform changes margins, not deliberate content suffix whitespace; the literal expected source independently preserves those suffixes.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares exact authored output and requires clean re-lint without deleting content trailing spaces.
// @evidence contracts/testing.md#independent-expectations The supported transform changes margins, not deliberate content suffix whitespace; the literal expected source independently preserves those suffixes.
// @evidence contracts/testing.md#distinguishing-cases Both original content lines retain distinct trailing-space runs while their left margins change.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentPreservesContentTrailingSpaces owns its explicit variants and named subcases as a discoverable Go unit entry; real parser/engine snapshots and disk fix application compare preserved content suffix spaces and clean re-lint in the Go test process; no installed consumer, native producer or product child host runs.
func TestUnicornTemplateIndentPreservesContentTrailingSpaces(t *testing.T) {
  source := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "one    \n" +
    "  child  \n" +
    "`;\n"
  expected := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "  one    \n" +
    "    child  \n" +
    "`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
