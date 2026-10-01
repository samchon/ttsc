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
//
// @evidence contracts/testing.md#behavioral-verification An off no-var configuration has no active rules and returns no findings for a var statement, while the same source with error severity reports one no-var error.
// @evidence contracts/testing.md#independent-expectations Off/error severity policy independently changes the result on the identical violating source, so an absent rule implementation cannot satisfy the zero-only case.
// @evidence contracts/testing.md#distinguishing-cases Same source and off versus error distinguish explicit disabling from a rule that never reports; the original empty enabled-map and zero-finding checks remain.
// @evidence contracts/testing.md#execution-ownership Two actual NewEngine instances directly walk the same parsed virtual source in the shared Go process; this entry observes real findings without consumer installation or native host execution.
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
  active := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(active) != 1 || active[0].File != file || active[0].Rule != "no-var" || active[0].Severity != SeverityError {
    t.Fatalf("error-severity control did not report the original var: %+v", active)
  }
}
