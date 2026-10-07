package linthost

import "testing"

// assertVitestOrdinaryRuleErrors rejects engine recovery and wrong severity
// before the original finding-count and rule-identity checks run.
func assertVitestOrdinaryRuleErrors(t *testing.T, ruleName string, findings []*Finding) {
  t.Helper()
  for _, finding := range findings {
    if finding.engineFailure || finding.Severity != SeverityError || finding.Rule != ruleName {
      t.Fatalf("want ordinary %s error, got %+v", ruleName, finding)
    }
  }
}
