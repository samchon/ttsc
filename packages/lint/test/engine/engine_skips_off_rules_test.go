package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineSkipsOffRules verifies that rules configured with SeverityOff are not wired
// into the engine's dispatch table and produce zero findings.
//
// SeverityOff is the explicit opt-out value. It must behave identically to omitting a
// rule from the config altogether — the rule must not appear in EnabledRules() and must
// not fire. This pins the severity-filter in NewEngine so a refactor that changes the
// sentinel from 0 to some other value still needs to update the filter consistently.
//
// 1. Build an engine with noVar configured as SeverityOff.
// 2. Assert EnabledRules() is empty (no active rules).
// 3. Parse a source file with a var statement and assert zero findings.
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
