package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "testing"
)

// TestEngineBlockDisableAfterCodeDoesNotSuppressEarlierSameLine verifies engine block disable
// after code does not suppress earlier same line.
//
// The lint engine walks tsgo SourceFiles and dispatches nodes only to enabled rules. Engine
// tests use parsed virtual TypeScript files so directive suppression, declaration-file
// filtering, and unknown-rule tracking are verified without shelling out to the command
// wrapper.
//
// This scenario focuses on engine block disable after code does not suppress earlier same line.
// It keeps rule execution observable through findings so the test can distinguish dispatch
// behavior from config loading and output rendering.
//
// 1. Parse a virtual TypeScript source file that isolates the engine branch.
// 2. Run the engine with the exact rule severities needed by the branch.
// 3. Assert the produced findings, skipped findings, or unknown-rule ledger.
func TestEngineBlockDisableAfterCodeDoesNotSuppressEarlierSameLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var reported = 1; /* eslint-disable no-var */
    var skipped = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 finding, got %d: %v", got, findingRules(findings))
  }
}
