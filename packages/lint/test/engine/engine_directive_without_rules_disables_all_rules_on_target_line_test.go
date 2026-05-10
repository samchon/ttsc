package main

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	"testing"
)

// TestEngineDirectiveWithoutRulesDisablesAllRulesOnTargetLine verifies engine directive without
// rules disables all rules on target line.
//
// The lint engine walks tsgo SourceFiles and dispatches nodes only to enabled rules. Engine
// tests use parsed virtual TypeScript files so directive suppression, declaration-file
// filtering, and unknown-rule tracking are verified without shelling out to the command
// wrapper.
//
// This scenario focuses on engine directive without rules disables all rules on target line. It
// keeps rule execution observable through findings so the test can distinguish dispatch
// behavior from config loading and output rendering.
//
// 1. Parse a virtual TypeScript source file that isolates the engine branch.
// 2. Run the engine with the exact rule severities needed by the branch.
// 3. Assert the produced findings, skipped findings, or unknown-rule ledger.
func TestEngineDirectiveWithoutRulesDisablesAllRulesOnTargetLine(t *testing.T) {
	engine := NewEngine(RuleConfig{
		"no-var":      SeverityError,
		"no-debugger": SeverityError,
	})
	file := parseTS(t, `
    // eslint-disable-next-line
    var skipped = 1; debugger;
    var reported = 2; debugger;
  `)
	findings := engine.Run([]*shimast.SourceFile{file}, nil)
	if got := len(findings); got != 2 {
		t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
	}
}
