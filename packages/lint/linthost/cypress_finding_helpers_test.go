package linthost

import "testing"

// assertCypressOrdinaryRuleErrors rejects recovered engine failures and
// wrong-severity findings before a rule-name/count assertion can accept them.
func assertCypressOrdinaryRuleErrors(t *testing.T, ruleName string, findings []*Finding) {
  t.Helper()
  for _, finding := range findings {
    if finding.engineFailure || finding.Severity != SeverityError || finding.Rule != ruleName {
      t.Fatalf("want ordinary %s error, got %+v", ruleName, finding)
    }
  }
}
