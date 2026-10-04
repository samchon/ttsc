package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentFixesEmptyBoundaryQuasisWithInsertions verifies that the actual fixer requires three quasi edits, zero-width boundary insertions and exact authored clean output.
//
// Empty leading/trailing quasis need insertions around unchanged substitutions rather than deleting expression text; the literal output independently establishes that contract.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer requires three quasi edits, zero-width boundary insertions and exact authored clean output.
// @evidence contracts/testing.md#independent-expectations Empty leading/trailing quasis need insertions around unchanged substitutions rather than deleting expression text; the literal output independently establishes that contract.
// @evidence contracts/testing.md#distinguishing-cases Both empty boundary quasis and the nonempty middle quasi retain their distinct insertion/replacement checks.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentFixesEmptyBoundaryQuasisWithInsertions owns its explicit variants and named subcases as a discoverable Go unit entry; real parser/engine snapshots and disk fix application compare zero-width quasi edits, full source and clean re-lint in the Go test process; no installed consumer, native producer or product child host runs.
func TestUnicornTemplateIndentFixesEmptyBoundaryQuasisWithInsertions(t *testing.T) {
  source := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`${value}\none${other}`;\n"
  expected := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`\n  ${value}\n  one${other}\n`;\n"

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornTemplateIndentRuleName, findings)
  if len(findings) != 1 || len(findings[0].Fix) != 3 {
    t.Fatalf("empty boundary quasis must produce three edits, got %+v", findings)
  }
  if findings[0].Fix[0].Pos != findings[0].Fix[0].End ||
    findings[0].Fix[2].Pos != findings[0].Fix[2].End {
    t.Fatalf("boundary quasi edits must be zero-width insertions, got %+v", findings[0].Fix)
  }
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
