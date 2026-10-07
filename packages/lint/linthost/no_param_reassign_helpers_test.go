package linthost

import (
  "encoding/json"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
  "sort"
  "testing"
)

type noParamReassignFinding struct {
  line    int
  target  string
  message string
}

func runNoParamReassign(
  t *testing.T,
  source string,
  options json.RawMessage,
) []noParamReassignFinding {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-param-reassign", source, options)
  normalized := make([]noParamReassignFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != "no-param-reassign" || finding.Severity != SeverityError {
      t.Fatalf("unexpected rule in no-param-reassign findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("no-param-reassign must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End < finding.Pos || finding.End > len(source) {
      t.Fatalf("no-param-reassign returned an invalid source range: %+v", finding)
    }
    normalized = append(normalized, noParamReassignFinding{
      line:    shimscanner.GetECMALineOfPosition(finding.File, finding.Pos) + 1,
      target:  source[finding.Pos:finding.End],
      message: finding.Message,
    })
  }
  sort.Slice(normalized, func(i, j int) bool {
    if normalized[i].line != normalized[j].line {
      return normalized[i].line < normalized[j].line
    }
    return normalized[i].message < normalized[j].message
  })
  return normalized
}

func assertNoParamReassignFindings(
  t *testing.T,
  got []noParamReassignFinding,
  want ...noParamReassignFinding,
) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("no-param-reassign finding count mismatch: want=%+v got=%+v", want, got)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("no-param-reassign finding[%d] mismatch: want=%+v got=%+v all=%+v", index, want[index], got[index], got)
    }
  }
}
