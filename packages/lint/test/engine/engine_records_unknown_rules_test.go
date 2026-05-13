package main

import (
  "testing"
)

// TestEngineRecordsUnknownRules verifies engine records unknown rules.
//
// The lint engine walks tsgo SourceFiles and dispatches nodes only to enabled rules. Engine
// tests use parsed virtual TypeScript files so directive suppression, declaration-file
// filtering, and unknown-rule tracking are verified without shelling out to the command
// wrapper.
//
// This scenario focuses on engine records unknown rules. It keeps rule execution observable
// through findings so the test can distinguish dispatch behavior from config loading and output
// rendering.
//
// 1. Parse a virtual TypeScript source file that isolates the engine branch.
// 2. Run the engine with the exact rule severities needed by the branch.
// 3. Assert the produced findings, skipped findings, or unknown-rule ledger.
func TestEngineRecordsUnknownRules(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "never-existed": SeverityError,
    "no-var":        SeverityError,
  })
  unknown := engine.UnknownRules()
  if len(unknown) != 1 || unknown[0] != "never-existed" {
    t.Fatalf("want [never-existed], got %v", unknown)
  }
  if _, ok := engine.EnabledRules()["never-existed"]; ok {
    t.Errorf("unknown rule should not be enabled")
  }
  if _, ok := engine.EnabledRules()["no-var"]; !ok {
    t.Errorf("known rule should still be enabled")
  }
}
