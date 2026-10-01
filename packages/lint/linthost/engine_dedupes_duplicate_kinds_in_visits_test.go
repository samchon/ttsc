package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDedupesDuplicateKindsInVisits verifies the engine drops
// repeated Kind entries inside a rule's Visits() list so the rule fires
// once per matching node, not once per duplicate.
//
// Defensive measure against contributor footguns: a third-party rule
// that accidentally lists the same Kind twice (e.g. via a generated
// constant or a copy-paste) would otherwise double-fire because
// NewEngine appends to `e.rules[kind]` per Visits() entry without
// dedup, and `Engine.Run` dispatches every entry. The dedup happens at
// engine wiring time, not in the rule itself, so both built-in and
// contributor rules are covered transparently.
//
//  1. Register a custom rule whose `Visits()` returns the same Kind
//     twice.
//  2. Parse a source file that contains one node of that Kind.
//  3. Run the engine and assert exactly one finding (not two).
//
// @evidence contracts/testing.md#behavioral-verification NewEngine deduplicates two identical Visits subscriptions so the authored custom rule reports exactly once for the single variable statement.
// @evidence contracts/testing.md#independent-expectations One matching statement and literal duplicate-kinds rule fired message independently require exactly one finding with the configured rule/error/file identity.
// @evidence contracts/testing.md#distinguishing-cases Repeated identical Kind entries versus one matching AST node distinguish duplicate binding from ordinary traversal; cleanup removes the temporary registration after this individual case.
// @evidence contracts/testing.md#execution-ownership Actual Register, NewEngine and Engine.Run directly exercise the authored Go rule in one shared process; this unit does not compile or start a native contributor host.
func TestEngineDedupesDuplicateKindsInVisits(t *testing.T) {
  // Defensive: `Register` panics on duplicates, so a `go test -count=N`
  // re-run would crash before `defer` could clean up. Drop any prior
  // entry first and schedule the cleanup via `t.Cleanup` so it fires
  // for panics + Fatal alike.
  delete(registered.rules, "dedupe-visits-test/rule")
  t.Cleanup(func() { delete(registered.rules, "dedupe-visits-test/rule") })
  Register(&duplicateKindsTestRule{})

  engine := NewEngine(RuleConfig{
    "dedupe-visits-test/rule": SeverityError,
  })
  file := parseTS(t, `var only = 1;`)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding after dedup, got %d", len(findings))
  }
  if findings[0].File != file || findings[0].Severity != SeverityError || findings[0].Message != "duplicate-kinds rule fired" {
    t.Fatalf("custom diagnostic contract changed: %+v", findings[0])
  }
  if findings[0].Rule != "dedupe-visits-test/rule" {
    t.Errorf("want rule name %q, got %q", "dedupe-visits-test/rule", findings[0].Rule)
  }
}

type duplicateKindsTestRule struct{}

func (*duplicateKindsTestRule) Name() string { return "dedupe-visits-test/rule" }
func (*duplicateKindsTestRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement, shimast.KindVariableStatement}
}
func (*duplicateKindsTestRule) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "duplicate-kinds rule fired")
}
