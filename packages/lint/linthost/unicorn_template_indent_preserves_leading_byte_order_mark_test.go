package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTemplateIndentPreservesLeadingByteOrderMark verifies that the fixer compares the exact authored output including the leading BOM and requires clean re-lint.
//
// A leading byte-order mark is source content outside the transformed template; the independent literal output preserves exactly one leading mark.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares the exact authored output including the leading BOM and requires clean re-lint.
// @evidence contracts/testing.md#independent-expectations A leading byte-order mark is source content outside the transformed template; the independent literal output preserves exactly one leading mark.
// @evidence contracts/testing.md#distinguishing-cases The BOM-bearing source must change indentation while keeping the leading mark unchanged.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentPreservesLeadingByteOrderMark owns its explicit variants and named subcases as a discoverable Go unit entry; real parser/engine snapshots and disk fix application compare the literal leading-BOM output and clean re-lint in the Go test process; no installed consumer, native producer or product child host runs.
func TestUnicornTemplateIndentPreservesLeadingByteOrderMark(t *testing.T) {
  source := "\uFEFFconst query = gql`\none\n`;\n"
  expected := "\uFEFFconst query = gql`\n  one\n`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if strings.Count(expected, "\uFEFF") != 1 || !strings.HasPrefix(expected, "\uFEFF") {
    t.Fatal("the fixed source must preserve exactly one leading byte-order mark")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
