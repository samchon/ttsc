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
//
//  1. Construct contexts through both public constructors and mutate input, context and another invocation independently.
//  2. Require original JSON ownership in both directions and retain nil identity and empty length.
//
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
