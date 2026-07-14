package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func assertNoInnerDeclarationsCase(t *testing.T, name, source, options string) {
  t.Helper()
  expected := parseRuleExpectations(t, source)
  file := parseTSFile(t, "/virtual/"+name, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"no-inner-declarations": SeverityError},
  }
  if options != "" {
    resolver.Options = RuleOptionsMap{
      "no-inner-declarations": json.RawMessage(options),
    }
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(expected) {
    t.Fatalf("%s: want %v, got %v", name, expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("%s[%d]: want %+v, got %+v; all findings=%+v", name, i, expected[i], actual[i], actual)
    }
  }
}
