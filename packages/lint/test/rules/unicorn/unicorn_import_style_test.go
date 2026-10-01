package linthost

import (
  "encoding/json"
  "sort"
  "testing"
)

const unicornImportStyleRuleName = "unicorn/import-style"

// unicornImportStylePolicyOptions mirrors the options fixture upstream's
// test suite applies to every case: four synthetic modules, each named
// after the one style it allows.
const unicornImportStylePolicyOptions = `{
  "checkExportFrom": true,
  "styles": {
    "unassigned": {"unassigned": true, "named": false},
    "default": {"default": true, "named": false},
    "namespace": {"namespace": true, "named": false},
    "named": {"named": true}
  }
}`

type unicornImportStyleFinding struct {
  target  string
  message string
}

// runUnicornImportStyleFindings executes the rule over one source file
// and normalizes every finding to its exact source range and message.
// The helper also locks the structural invariants shared by all cases:
// the rule never offers edits and never reports an invalid range.
func runUnicornImportStyleFindings(t *testing.T, source, optionsJSON string) []unicornImportStyleFinding {
  t.Helper()
  var options json.RawMessage
  if optionsJSON != "" {
    options = json.RawMessage(optionsJSON)
  }
  _, _, findings := runRuleFindingsSnapshot(t, unicornImportStyleRuleName, source, options)
  type positionedFinding struct {
    pos     int
    finding unicornImportStyleFinding
  }
  entries := make([]positionedFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.engineFailure || finding.Severity != SeverityError || finding.Rule != unicornImportStyleRuleName {
      t.Fatalf("unexpected rule in findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("unicorn/import-style must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End <= finding.Pos || finding.End > len(source) {
      t.Fatalf("unicorn/import-style returned an invalid source range: %+v", finding)
    }
    entries = append(entries, positionedFinding{
      pos: finding.Pos,
      finding: unicornImportStyleFinding{
        target:  source[finding.Pos:finding.End],
        message: finding.Message,
      },
    })
  }
  sort.SliceStable(entries, func(i, j int) bool {
    return entries[i].pos < entries[j].pos
  })
  normalized := make([]unicornImportStyleFinding, len(entries))
  for index, entry := range entries {
    normalized[index] = entry.finding
  }
  return normalized
}

func assertUnicornImportStyleFindings(
  t *testing.T,
  got []unicornImportStyleFinding,
  want ...unicornImportStyleFinding,
) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("finding count mismatch:\nwant %+v\ngot  %+v", want, got)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("finding[%d] mismatch:\nwant %+v\ngot  %+v\nall  %+v", index, want[index], got[index], got)
    }
  }
}

