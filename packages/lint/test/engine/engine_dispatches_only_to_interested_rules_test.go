package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDispatchesOnlyToInterestedRules verifies that the engine routes AST nodes
// only to rules that registered for the corresponding Kind, and that each rule fires
// exactly once per matching node.
//
// The core engine contract is per-Kind dispatch: each rule declares which node kinds it
// cares about via Visits(), and NewEngine wires a kind → []Rule mapping. If a rule were
// also invoked on unregistered kinds it would either fire spuriously or panic on an
// unsupported node cast. This test uses two rules with non-overlapping kind sets on one
// source file to confirm independent dispatch counts.
//
// 1. Build an engine with no-var (KindVariableStatement) and no-debugger (KindDebuggerStatement).
// 2. Parse a file with two var declarations and one debugger statement.
// 3. Assert three total findings split 2 and 1 across the two rules.
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
