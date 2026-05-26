package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func assertSolidFindings(t *testing.T, source string, rules RuleConfig, expected []ruleExpectation) {
  t.Helper()
  file := parseTSXFile(t, "/virtual/component.tsx", source)
  findings := NewEngine(rules).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
}
