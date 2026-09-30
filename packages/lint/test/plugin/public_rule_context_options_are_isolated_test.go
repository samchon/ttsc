package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextOptionsAreIsolated verifies both public constructors
// give contributors their own option bytes. A contributor is free to decode or
// retain its Context, but mutating that Context must never corrupt the host's
// resolver state or another invocation.
// @evidence contracts/testing.md#behavioral-verification Both public Context constructors isolate option bytes from their input and other invocations in both mutation directions, while retaining nil options and empty length.
// @evidence contracts/testing.md#independent-expectations The independently authored JSON mode loud must remain byte-exact after deliberate corruption of another buffer's first byte. Literal original JSON, nil identity and empty length define outcomes without using the constructor to compute expectations.
// @evidence contracts/testing.md#distinguishing-cases Each constructor exercises input mutation, context mutation, separate invocation mutation, nil and nonnil-empty input. Bidirectional and cross-invocation controls distinguish copying once from continued ownership isolation.
// @evidence contracts/testing.md#execution-ownership Actual public constructors allocate Contexts directly in-process, with controlled RawMessage mutations; no installed host, plugin artifact, compiler subprocess or repository-file inspection executes.
func TestPublicRuleContextOptionsAreIsolated(t *testing.T) {
  constructors := []struct {
    name string
    make func(json.RawMessage) *publicrule.Context
  }{
    {
      name: "NewContext",
      make: func(options json.RawMessage) *publicrule.Context {
        return publicrule.NewContext(nil, nil, publicrule.SeverityError, options, nil)
      },
    },
    {
      name: "NewContextWithProjectResults",
      make: func(options json.RawMessage) *publicrule.Context {
        return publicrule.NewContextWithProjectResults(
          nil,
          nil,
          publicrule.SeverityError,
          options,
          nil,
          nil,
        )
      },
    },
  }

  for _, constructor := range constructors {
    t.Run(constructor.name+"/input mutation", func(t *testing.T) {
      options := json.RawMessage(`{"mode":"loud"}`)
      ctx := constructor.make(options)
      options[0] = '['
      if got, want := string(ctx.Options), `{"mode":"loud"}`; got != want {
        t.Fatalf("Context options alias constructor input: got %q, want %q", got, want)
      }
    })

    t.Run(constructor.name+"/context mutation", func(t *testing.T) {
      options := json.RawMessage(`{"mode":"loud"}`)
      ctx := constructor.make(options)
      ctx.Options[0] = '['
      if got, want := string(options), `{"mode":"loud"}`; got != want {
        t.Fatalf("constructor input aliases Context options: got %q, want %q", got, want)
      }
    })

    t.Run(constructor.name+"/invocation isolation", func(t *testing.T) {
      options := json.RawMessage(`{"mode":"loud"}`)
      first := constructor.make(options)
      second := constructor.make(options)
      first.Options[0] = '['
      if got, want := string(second.Options), `{"mode":"loud"}`; got != want {
        t.Fatalf("public Contexts share option bytes: got %q, want %q", got, want)
      }
    })

    t.Run(constructor.name+"/nil and empty", func(t *testing.T) {
      if got := constructor.make(nil).Options; got != nil {
        t.Fatalf("nil options became non-nil: %#v", got)
      }
      if got := constructor.make(json.RawMessage{}).Options; len(got) != 0 {
        t.Fatalf("empty options changed length: %d", len(got))
      }
    })
  }
}

// TestContributorCannotMutateLaterInvocationOptions exercises the host adapter,
// not only the public constructors. The first file deliberately corrupts its
// public Context; the second file and the resolver must still observe the
// original JSON document.
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

type optionMutatingContributor struct {
  observed []string
}

func (*optionMutatingContributor) Name() string { return "demo/option-mutator" }
func (*optionMutatingContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (c *optionMutatingContributor) Check(ctx *publicrule.Context, _ *shimast.Node) {
  var options struct {
    Mode string `json:"mode"`
  }
  _ = ctx.DecodeOptions(&options)
  c.observed = append(c.observed, options.Mode)
  if len(ctx.Options) != 0 {
    ctx.Options[0] = '['
  }
}
