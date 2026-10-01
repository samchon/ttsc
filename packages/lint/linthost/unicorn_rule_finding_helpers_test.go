package linthost

import "testing"

// assertUnicornRuleErrorFindingIdentities prevents a recovered panic, wrong
// rule or non-error finding from satisfying count-only semantic assertions.
func assertUnicornRuleErrorFindingIdentities(t *testing.T, ruleName string, findings []*Finding) {
  t.Helper()
  for _, finding := range findings {
    if finding.engineFailure || finding.Rule != ruleName || finding.Severity != SeverityError {
      t.Fatalf("want ordinary %s error finding, got %+v", ruleName, finding)
    }
  }
}
