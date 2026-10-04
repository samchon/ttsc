package linthost

import (
  "testing"
)

const unicornConsistentFunctionScopingRuleName = "unicorn/consistent-function-scoping"

// TestRuleCorpusUnicornConsistentFunctionScoping reports the capture-free nested normalizer.
//
// A function depending only on its own parameters is capture-free under the supported scoping policy, independently requiring the authored report.
//
// 1. Execute the authored nested-normalizer source.
// 2. Compare the annotated rule, error severity and line.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed NewEngine.Run compares the annotated nested normalize function diagnostics.
// @evidence contracts/testing.md#independent-expectations A function depending only on its own parameters is capture-free under the supported scoping policy, independently requiring the authored report.
// @evidence contracts/testing.md#distinguishing-cases The parameter-only nested normalizer reports once; the outer function and receiver property names add no findings.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornConsistentFunctionScoping owns its authored source as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestRuleCorpusUnicornConsistentFunctionScoping(t *testing.T) {
  source := `export function formatNames(names: string[]): string[] {
  // expect: unicorn/consistent-function-scoping error
  function normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  return names.map(normalize);
}
`
  expected := parseRuleExpectations(t, source)
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) == 0 {
    t.Fatalf("want %v, got no findings", expected)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("finding[%d]: want %+v, got %+v", index, expected[index], actual[index])
    }
  }
}














