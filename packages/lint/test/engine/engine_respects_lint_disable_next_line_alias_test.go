package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "testing"
)

// TestEngineRespectsLintDisableNextLineAlias verifies engine respects lint disable next line
// alias.
//
// The lint engine walks tsgo SourceFiles and dispatches nodes only to enabled rules. Engine
// tests use parsed virtual TypeScript files so directive suppression, declaration-file
// filtering, and unknown-rule tracking are verified without shelling out to the command
// wrapper.
//
// This scenario focuses on engine respects lint disable next line alias. It keeps rule
// execution observable through findings so the test can distinguish dispatch behavior from
// config loading and output rendering.
//
// 1. Parse a virtual TypeScript source file that isolates the engine branch.
// 2. Run the engine with the exact rule severities needed by the branch.
// 3. Assert the produced findings, skipped findings, or unknown-rule ledger.
func TestEngineRespectsLintDisableNextLineAlias(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-debugger": SeverityError})
  file := parseTS(t, `
    debugger;
    // lint-disable-next-line no-debugger
    debugger;
    debugger;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
