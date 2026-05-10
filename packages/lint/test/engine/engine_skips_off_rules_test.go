package main

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	"testing"
)

// TestEngineSkipsOffRules verifies engine skips off rules.
//
// The lint engine walks tsgo SourceFiles and dispatches nodes only to enabled rules. Engine
// tests use parsed virtual TypeScript files so directive suppression, declaration-file
// filtering, and unknown-rule tracking are verified without shelling out to the command
// wrapper.
//
// This scenario focuses on engine skips off rules. It keeps rule execution observable through
// findings so the test can distinguish dispatch behavior from config loading and output
// rendering.
//
// 1. Parse a virtual TypeScript source file that isolates the engine branch.
// 2. Run the engine with the exact rule severities needed by the branch.
// 3. Assert the produced findings, skipped findings, or unknown-rule ledger.
func TestEngineSkipsOffRules(t *testing.T) {
	engine := NewEngine(RuleConfig{
		"no-var": SeverityOff,
	})
	if len(engine.EnabledRules()) != 0 {
		t.Fatalf("want 0 enabled, got %d", len(engine.EnabledRules()))
	}
	file := parseTS(t, "var a = 1;")
	findings := engine.Run([]*shimast.SourceFile{file}, nil)
	if len(findings) != 0 {
		t.Errorf("disabled rule should not fire; got %d findings", len(findings))
	}
}
