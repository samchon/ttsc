package linthost

import (
  "testing"
)

const unicornPreventAbbreviationsRuleName = "unicorn/prevent-abbreviations"

// TestRuleCorpusUnicornPreventAbbreviations verifies that the checker-backed engine compares the annotated errCb binding diagnostic.
//
// The supported err/cb dictionary independently expands this compound name to errorCallback.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed engine compares the annotated errCb binding diagnostic.
// @evidence contracts/testing.md#independent-expectations The supported err/cb dictionary independently expands this compound name to errorCallback.
// @evidence contracts/testing.md#distinguishing-cases The original binding/use corpus reports; independent full-name and ignore controls belong to options hosts.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreventAbbreviations owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
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


















































