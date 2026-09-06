package evidence

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies overlapping references retain independent diagnostic levels.
 *
 * Identical populations must not pool their severities or coverage. An off
 * reference must also avoid loading a nonexistent source.
 *
 * 1. Select the same uncited requirement twice at different levels.
 * 2. Add an off reference naming a missing root.
 * 3. Assert one warning and one error with the original reference indexes.
 */
func TestGraphSeverityKeepsReferencesIndependent(t *testing.T) {
  reporter := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
    "src/contract.ts": "export interface IContract {}\n",
    "docs/spec.md":    "## Requirement {#requirement}\n",
  }, `{"claims":[{"type":"typescript","files":["src/**"],"symbol":"type","severity":"warning","reference":[
    {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"},
    {"type":"markdown","root":"missing","files":["**"],"severity":"off"},
    {"type":"markdown","files":["docs/spec.md"],"symbol":"h2","severity":"error"}
  ]}]}`, rule.SeverityError)
  if len(reporter.findings) != 2 {
    t.Fatalf("want two independent findings, got %v", reporter.messages)
  }
  for _, finding := range reporter.findings {
    want := rule.SeverityWarn
    if strings.Contains(finding.Message, "reference 3") {
      want = rule.SeverityError
    }
    if finding.Severity != want {
      t.Fatalf("wrong severity: %#v", finding)
    }
    if strings.Contains(finding.Message, "missing") {
      t.Fatalf("off reference loaded: %v", finding)
    }
  }
}
