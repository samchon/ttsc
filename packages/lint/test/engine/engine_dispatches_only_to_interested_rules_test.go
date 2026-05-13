package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "testing"
)

// TestEngineDispatchesOnlyToInterestedRules verifies engine dispatches only to interested
// rules.
//
// The lint engine walks tsgo SourceFiles and dispatches nodes only to enabled rules. Engine
// tests use parsed virtual TypeScript files so directive suppression, declaration-file
// filtering, and unknown-rule tracking are verified without shelling out to the command
// wrapper.
//
// This scenario focuses on engine dispatches only to interested rules. It keeps rule execution
// observable through findings so the test can distinguish dispatch behavior from config loading
// and output rendering.
//
// 1. Parse a virtual TypeScript source file that isolates the engine branch.
// 2. Run the engine with the exact rule severities needed by the branch.
// 3. Assert the produced findings, skipped findings, or unknown-rule ledger.
func TestEngineDispatchesOnlyToInterestedRules(t *testing.T) {
  // Build an engine with two rules enabled. The walker should call
  // each rule only on the kinds it registered for.
  engine := NewEngine(RuleConfig{
    "no-var":      SeverityError,
    "no-debugger": SeverityWarn,
  })
  if got := engine.EnabledRules(); len(got) != 2 {
    t.Fatalf("want 2 enabled rules, got %d", len(got))
  }
  file := parseTS(t, `
    var a = 1;
    debugger;
    var b = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 3 {
    t.Fatalf("want 3 findings, got %d", len(findings))
  }
  names := map[string]int{}
  for _, f := range findings {
    names[f.Rule]++
  }
  if names["no-var"] != 2 || names["no-debugger"] != 1 {
    t.Errorf("expected 2 no-var + 1 no-debugger, got %v", names)
  }
}
