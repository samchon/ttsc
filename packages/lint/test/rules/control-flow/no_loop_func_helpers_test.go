package linthost

import (
  "sort"
  "testing"

  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type noLoopFuncFinding struct {
  line    int
  target  string
  message string
}

func runNoLoopFunc(t *testing.T, source string) []noLoopFuncFinding {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-loop-func", source, nil)
  normalized := make([]noLoopFuncFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != "no-loop-func" {
      t.Fatalf("unexpected rule in no-loop-func findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("no-loop-func must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End < finding.Pos || finding.End > len(source) {
      t.Fatalf("no-loop-func returned an invalid source range: %+v", finding)
    }
    normalized = append(normalized, noLoopFuncFinding{
      line:    shimscanner.GetECMALineOfPosition(finding.File, finding.Pos) + 1,
      target:  source[finding.Pos:finding.End],
      message: finding.Message,
    })
  }
  sort.Slice(normalized, func(i, j int) bool {
    if normalized[i].line != normalized[j].line {
      return normalized[i].line < normalized[j].line
    }
    return normalized[i].target < normalized[j].target
  })
  return normalized
}

func assertNoLoopFuncFindings(t *testing.T, got []noLoopFuncFinding, want ...noLoopFuncFinding) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("no-loop-func finding count mismatch: want=%+v got=%+v", want, got)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("no-loop-func finding[%d] mismatch: want=%+v got=%+v all=%+v", index, want[index], got[index], got)
    }
  }
}
