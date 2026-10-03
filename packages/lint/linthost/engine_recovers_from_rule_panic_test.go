package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Real Engine invocation of an authored panicking rule yields exactly one error under test/panic-bomb, marked engineFailure and retaining synthetic panic for engine-recovery test instead of escaping as a Go panic.
// @evidence contracts/testing.md#independent-expectations The literal throwing message, rule identity, error severity and one-finding cardinality independently specify recovery; engineFailure distinguishes actual execution failure from an ordinary rule message containing panicked.
// @evidence contracts/testing.md#distinguishing-cases A real SourceFile visit triggers the panic; recovered-failure semantics are deliberately tested directly rather than filtered through the normal semantic guard. A fresh-name guard and deferred owned cleanup invalidate derived rule codes. Sibling quarantine units cover other rules and later files.
// @evidence contracts/testing.md#execution-ownership Actual Register and Engine.Run execute a synthetic internal rule in-process with deferred registration cleanup; no public adapter, native producer, installation or CLI recovery is claimed.
func TestEngineRecoversFromRulePanic(t *testing.T) {
  if LookupRule("test/panic-bomb") != nil {
    t.Fatal("panic-recovery sentinel is already registered")
  }
  Register(panickingRule{})
  defer func() {
    delete(registered.rules, "test/panic-bomb")
    invalidateRuntimeRuleCodes()
  }()

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
  if !f.engineFailure || !strings.Contains(f.Message, "synthetic panic for engine-recovery test") {
    t.Fatalf("panic was not retained as an actual execution failure: %+v", f)
  }
}

type panickingRule struct{}

func (panickingRule) Name() string           { return "test/panic-bomb" }
func (panickingRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (panickingRule) Check(_ *Context, _ *shimast.Node) {
  panic("synthetic panic for engine-recovery test")
}
