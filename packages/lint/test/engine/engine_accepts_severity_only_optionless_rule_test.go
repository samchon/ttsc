package linthost

import "testing"

// TestEngineAcceptsSeverityOnlyOptionlessRule verifies the new options gate
// leaves the ordinary severity-only setting unchanged.
//
// Absence of an options slot is represented by a nil RawMessage. Optionless
// rules remain valid and enabled in that state; only a present payload is an
// error.
//
//  1. Enable `no-var` with a bare severity.
//  2. Construct the engine.
//  3. Assert no configuration error and an enabled dispatch entry.
func TestEngineAcceptsSeverityOnlyOptionlessRule(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("severity-only optionless rule was rejected: %v", err)
  }
  if engine.EnabledRules()["no-var"] != SeverityError {
    t.Fatalf("severity-only no-var was not enabled: %v", engine.EnabledRules())
  }
}
