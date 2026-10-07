package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "strings"
  "testing"
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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtSeverity runs the graph rule under an error severity over a warning-level typescript claim whose three references are the same uncited Markdown requirement (inherited warning), an `off` reference with the nonexistent root `missing`, and the same requirement at `error`; exactly two findings must result, the one naming `reference 3` at error and the other at warning, and none mentioning `missing`.
 * @evidence contracts/testing.md#independent-expectations The expected levels are authored from the severity contract: identical populations must not pool their severities or coverage, and an off reference must not load its source.
 * @evidence contracts/testing.md#distinguishing-cases Two references over one requirement with different levels plus an off reference with a bad root: pooling would give one finding, and loading the off reference would add a root failure.
 * @evidence contracts/testing.md#execution-ownership TestGraphSeverityKeepsReferencesIndependent is a Go unit entry in the native test process; runIndexRuleAtSeverity writes the fixtures to a temp directory and calls the graph rule with a captured reporter, with no consumer install or product host.
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
