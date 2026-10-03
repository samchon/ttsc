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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine accepts bare error severity for optionless no-var and retains its enabled dispatch entry.
// @evidence contracts/testing.md#independent-expectations Literal no-var/error and a nil ConfigError establish the supported absence-of-options contract independently of capability reflection.
// @evidence contracts/testing.md#distinguishing-cases A bare severity supplies no payload; null-tuple acceptance and four present-payload rejection shapes are separate selectable cases.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and accessor calls bind real registered rules in one Go process; this test observes configuration acceptance, not a source finding or CLI launch.
func TestEngineAcceptsSeverityOnlyOptionlessRule(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("severity-only optionless rule was rejected: %v", err)
  }
  if engine.EnabledRules()["no-var"] != SeverityError {
    t.Fatalf("severity-only no-var was not enabled: %v", engine.EnabledRules())
  }
}
