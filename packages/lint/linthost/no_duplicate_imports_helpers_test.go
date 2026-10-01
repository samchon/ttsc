package linthost

import (
  "encoding/json"
  "sort"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// duplicateImportsFinding is the normalized (line, message) pair the
// no-duplicate-imports unit cases assert on. Messages are part of the
// contract because the rule distinguishes the four official pairings
// (import/import, import/export, export/export, export/import), and a
// line-only assertion could not tell them apart.
type duplicateImportsFinding struct {
  Line    int
  Message string
}

// runNoDuplicateImports runs the no-duplicate-imports rule over one
// virtual TypeScript source with the given options JSON and returns
// normalized findings sorted by (line, message) so assertions do not
// depend on engine emission order.
func runNoDuplicateImports(t *testing.T, source, optsJSON string) []duplicateImportsFinding {
  t.Helper()
  const ruleName = "no-duplicate-imports"
  file := parseTSFile(t, "/virtual/no-duplicate-imports.ts", source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(optsJSON)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  out := make([]duplicateImportsFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != ruleName {
      t.Fatalf("unexpected rule %q in findings: %+v", finding.Rule, finding)
    }
    if len(finding.Fix) != 0 {
      t.Fatalf("no-duplicate-imports must not offer autofixes, got %+v", finding.Fix)
    }
    out = append(out, duplicateImportsFinding{
      Line:    shimscanner.GetECMALineOfPosition(file, finding.Pos) + 1,
      Message: finding.Message,
    })
  }
  sort.Slice(out, func(i, j int) bool {
    if out[i].Line != out[j].Line {
      return out[i].Line < out[j].Line
    }
    return out[i].Message < out[j].Message
  })
  return out
}

// assertDuplicateImportsFindings compares normalized findings against the
// expected (line, message) list. `want` must be pre-sorted by (line,
// message), matching runNoDuplicateImports output order.
func assertDuplicateImportsFindings(t *testing.T, got, want []duplicateImportsFinding) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("want %d findings %+v, got %d findings %+v", len(want), want, len(got), got)
  }
  for i := range want {
    if got[i] != want[i] {
      t.Fatalf("finding[%d]: want %+v, got %+v; all=%+v", i, want[i], got[i], got)
    }
  }
}

// assertNoDuplicateImportsFindings asserts the rule stayed silent.
func assertNoDuplicateImportsFindings(t *testing.T, got []duplicateImportsFinding) {
  t.Helper()
  if len(got) != 0 {
    t.Fatalf("expected zero findings, got %+v", got)
  }
}
