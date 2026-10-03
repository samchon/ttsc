package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDispatchesOnlyToInterestedRules verifies the observed diagnostic
// population matches each rule's interested Kind, once at each authored token.
//
// The core engine contract is per-Kind dispatch: each rule declares which node kinds it
// cares about via Visits(), and NewEngine wires a kind → []Rule mapping. If a rule were
// also invoked on unregistered kinds it could fire spuriously or ignore them.
// This test uses two rules with non-overlapping kind sets on one
// source file to confirm independent finding counts and token identities. It
// does not instrument Check calls that produce no finding.
//
// 1. Build an engine with noVar (KindVariableDeclarationList) and noDebugger (KindDebuggerStatement).
// 2. Parse a file with two var declarations and one debugger statement.
// 3. Assert three total findings split 2 and 1 across the two rules.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run reports two no-var errors and one no-debugger warning from one authored source with nonoverlapping interested AST kinds.
// @evidence contracts/testing.md#independent-expectations Two literal var statements and one debugger statement independently require the 2:1 rule population at their distinct authored token offsets; authored error and warning severities establish policy for each registered identity.
// @evidence contracts/testing.md#distinguishing-cases Owns simultaneous distinct-kind rules with different severities, so duplicate or missing token diagnostics and exchanged policies fail; silent extra Check calls are not observed. Duplicate Visits kinds are exercised in the dedicated contributor-like registration case.
// @evidence contracts/testing.md#execution-ownership NewEngine and Engine.Run consume one real parsed virtual source in the shared Go process; returned Finding identities, counts and severities are observed without contributor compilation, consumer installation or a host child.
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
  source := `
    var a = 1;
    debugger;
    var b = 2;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 3 {
    t.Fatalf("want 3 findings, got %d", len(findings))
  }
  names := map[string]int{}
  expected := map[string]map[int]bool{
    "no-var": {
      strings.Index(source, "var a"): true,
      strings.Index(source, "var b"): true,
    },
    "no-debugger": {strings.Index(source, "debugger;"): true},
  }
  for _, f := range findings {
    if f == nil || f.File != file || !expected[f.Rule][f.Pos] {
      t.Fatalf("unexpected or duplicate token diagnostic: %+v", f)
    }
    delete(expected[f.Rule], f.Pos)
    names[f.Rule]++
    switch f.Rule {
    case "no-var":
      if f.Severity != SeverityError {
        t.Errorf("no-var severity: want error, got %v", f.Severity)
      }
    case "no-debugger":
      if f.Severity != SeverityWarn {
        t.Errorf("no-debugger severity: want warning, got %v", f.Severity)
      }
    }
  }
  if names["no-var"] != 2 || names["no-debugger"] != 1 {
    t.Errorf("expected 2 noVar + 1 noDebugger, got %v", names)
  }
  for rule, positions := range expected {
    if len(positions) != 0 {
      t.Errorf("missing %s token diagnostics: %v", rule, positions)
    }
  }
}
