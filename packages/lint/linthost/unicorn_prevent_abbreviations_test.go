package linthost

import (
  "testing"
)

const unicornPreventAbbreviationsRuleName = "unicorn/prevent-abbreviations"

// TestRuleCorpusUnicornPreventAbbreviations verifies that the checker-backed engine compares the annotated errCb binding diagnostic.
//
// The supported err/cb dictionary independently expands this compound name to errorCallback.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed engine compares the annotated errCb binding diagnostic.
// @evidence contracts/testing.md#independent-expectations The supported err/cb dictionary independently expands this compound name to errorCallback.
// @evidence contracts/testing.md#distinguishing-cases The original binding/use corpus reports; independent full-name and ignore controls belong to options hosts.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreventAbbreviations owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and exact diagnostic or editor-suggestion comparisons run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestRuleCorpusUnicornPreventAbbreviations(t *testing.T) {
  source := "// expect: unicorn/prevent-abbreviations error\nconst errCb = (error: Error): void => {\n  console.error(error);\n};\n\nerrCb(new Error(\"fixture\"));\n"
  expected := parseRuleExpectations(t, source)
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreventAbbreviationsRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) == 0 {
    t.Fatalf("unicorn/prevent-abbreviations.ts: want %v, got no findings", expected)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  if len(actual) != len(expected) {
    t.Fatalf("unicorn/prevent-abbreviations.ts: want %v, got %v", expected, actual)
  }
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("unicorn/prevent-abbreviations.ts[%d]: want %+v, got %+v", index, expected[index], actual[index])
    }
  }
}


















































