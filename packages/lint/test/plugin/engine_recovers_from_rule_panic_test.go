package main

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRecoversFromRulePanic verifies that a panic inside a rule's
// Check is caught and converted to a SeverityError diagnostic instead
// of aborting the entire run.
//
// Contributor rules cross the public `rule.Context` boundary and can
// hit unexpected AST shapes the author didn't anticipate. Without a
// recover barrier, one panicking rule kills the user's `ttsc fix` /
// `ttsc check` invocation with a raw Go stack trace. The engine
// catches the panic, emits a SeverityError finding naming the offending
// rule, and continues with the rest of the rule set.
//
//  1. Register a synthetic in-process rule that panics on every visit.
//  2. Run the engine on a tiny file.
//  3. Assert exactly one finding fires, severity Error, with a message
//     that names the panicking rule and surfaces the recovery message.
func TestEngineRecoversFromRulePanic(t *testing.T) {
  Register(panickingRule{})
  defer delete(registered.rules, "test/panic-bomb")

  file := parseTS(t, "const x = 1;\n")
  findings := NewEngine(RuleConfig{"test/panic-bomb": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected 1 finding (the recovered panic), got %d:\n%v",
      len(findings), findings)
  }
  f := findings[0]
  if f.Rule != "test/panic-bomb" {
    t.Fatalf("want Rule=test/panic-bomb, got %q", f.Rule)
  }
  if f.Severity != SeverityError {
    t.Fatalf("want Severity=Error, got %v", f.Severity)
  }
  if !strings.Contains(f.Message, "panicked") {
    t.Fatalf("want message to mention panic, got %q", f.Message)
  }
}

type panickingRule struct{}

func (panickingRule) Name() string           { return "test/panic-bomb" }
func (panickingRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (panickingRule) Check(_ *Context, _ *shimast.Node) {
  panic("synthetic panic for engine-recovery test")
}
