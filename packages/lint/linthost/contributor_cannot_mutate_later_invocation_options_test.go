package linthost

import (
  "encoding/json"
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestContributorCannotMutateLaterInvocationOptions exercises the host adapter,
// not only the public constructors. The first file deliberately corrupts its
// public Context; the second file and the resolver must still observe the
// original JSON document.
//
//  1. Run the real option-mutating contributor serially over two parsed source files.
//  2. Require two loud observations and unchanged resolver JSON after the first context is corrupted.
//
// @evidence contracts/testing.md#behavioral-verification The real contributor adapter invokes a deliberately option-mutating contributor for two source files; both decode mode loud and the resolver's original JSON remains byte-exact after the first invocation corrupts its Context options.
// @evidence contracts/testing.md#independent-expectations Literal mode loud and original JSON specify each observed decode and retained resolver state independently of the adapter. Exactly two observations prove both real file callbacks executed rather than accepting an inert engine.
// @evidence contracts/testing.md#distinguishing-cases Serial source-file visits make the first Context corruption precede the second invocation, distinguishing isolated copies from shared option storage. Constructor-only ownership controls are separate in the sibling unit.
// @evidence contracts/testing.md#execution-ownership A real in-process Engine and inspected contributor adapter dispatch over two parsed source files, with registry cleanup. This owns adapter option isolation without claiming public registration, native source compilation, installation or a checker-dependent rule.
func TestContributorCannotMutateLaterInvocationOptions(t *testing.T) {
  contributor := &optionMutatingContributor{}
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatalf("inspect contributor: %v", err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  raw := json.RawMessage(`{"mode":"loud"}`)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{metadata.name: SeverityError},
    Options: RuleOptionsMap{
      metadata.name: raw,
    },
  }
  engine := NewEngineWithResolver(resolver)
  engine.SetSerial(true)
  engine.Run([]*shimast.SourceFile{
    parseTS(t, "const first = 1;\n"),
    parseTS(t, "const second = 2;\n"),
  }, nil)

  if got, want := len(contributor.observed), 2; got != want {
    t.Fatalf("contributor invocation count = %d, want %d", got, want)
  }
  for i, got := range contributor.observed {
    if want := "loud"; got != want {
      t.Fatalf("invocation %d decoded mode %q, want %q", i, got, want)
    }
  }
  if got, want := string(raw), `{"mode":"loud"}`; got != want {
    t.Fatalf("contributor corrupted resolver options: got %q, want %q", got, want)
  }
}
