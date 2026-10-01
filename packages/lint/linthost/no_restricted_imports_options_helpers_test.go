package linthost

import (
  "encoding/json"
  "sort"
  "testing"
)

type noRestrictedImportsFinding struct {
  target  string
  message string
  pos     int
}

func runNoRestrictedImports(
  t *testing.T,
  source string,
  options json.RawMessage,
) []noRestrictedImportsFinding {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-restricted-imports", source, options)
  normalized := make([]noRestrictedImportsFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != "no-restricted-imports" {
      t.Fatalf("unexpected rule in no-restricted-imports findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("no-restricted-imports must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End <= finding.Pos || finding.End > len(source) {
      t.Fatalf("no-restricted-imports returned an invalid source range: %+v", finding)
    }
    normalized = append(normalized, noRestrictedImportsFinding{
      target:  source[finding.Pos:finding.End],
      message: finding.Message,
      pos:     finding.Pos,
    })
  }
  sort.SliceStable(normalized, func(i, j int) bool {
    if normalized[i].pos != normalized[j].pos {
      return normalized[i].pos < normalized[j].pos
    }
    return normalized[i].message < normalized[j].message
  })
  return normalized
}

func noRestrictedImportsTargets(findings []noRestrictedImportsFinding) []string {
  targets := make([]string, len(findings))
  for index, finding := range findings {
    targets[index] = finding.target
  }
  return targets
}

func assertNoRestrictedImportsTargets(t *testing.T, findings []noRestrictedImportsFinding, want ...string) {
  t.Helper()
  got := noRestrictedImportsTargets(findings)
  if len(got) != len(want) {
    t.Fatalf("no-restricted-imports target count mismatch: want=%q got=%q findings=%+v", want, got, findings)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("no-restricted-imports target[%d] mismatch: want=%q got=%q all=%q", index, want[index], got[index], got)
    }
  }
}

func noRestrictedImportsValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-restricted-imports": SeverityError},
    Options: RuleOptionsMap{
      "no-restricted-imports": options,
    },
  })
}
