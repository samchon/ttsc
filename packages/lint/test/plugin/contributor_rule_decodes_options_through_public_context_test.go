package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorRuleDecodesOptionsThroughPublicContext verifies a
// third-party rule that uses `ctx.DecodeOptions` receives the user's
// options blob through `contributorAdapter`.
//
// Built-in rules in `package main` read `Context.Options` directly; the
// public `rule.Context` exposes the same field and a `DecodeOptions`
// helper so contributors can ship `[severity, options]`-aware rules
// without coupling to host internals. The adapter at
// `contrib_adapter.go::Check` must thread `Options` from the engine's
// internal Context into the public Context — otherwise contributor
// rules silently see nil options and fall back to defaults.
//
//  1. Inspect and install a synthetic contributor adapter that decodes a
//     `Mode` option and asserts the decoded value.
//  2. Run the engine with an InlineRuleResolver that supplies the
//     options blob the contributor expects.
//  3. Confirm the rule observed the user's option, not the zero value.
func TestContributorRuleDecodesOptionsThroughPublicContext(t *testing.T) {
  recorder := &optionRecorder{}
  contributor := &optionConsumingContributor{recorder: recorder}
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatalf("inspect contributor: %v", err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  file := parseTS(t, "const x = 1;\n")
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"demo/option-consumer": SeverityError},
    Options: RuleOptionsMap{
      "demo/option-consumer": json.RawMessage(`{"mode":"loud"}`),
    },
  }
  _ = NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if recorder.observed != "loud" {
    t.Fatalf("contributor rule did not receive options through public Context: got %q", recorder.observed)
  }
}

type optionRecorder struct {
  observed string
}

type optionConsumingContributor struct {
  recorder *optionRecorder
}

func (o *optionConsumingContributor) Name() string { return "demo/option-consumer" }
func (o *optionConsumingContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (o *optionConsumingContributor) Check(ctx *rule.Context, _ *shimast.Node) {
  var opts struct {
    Mode string `json:"mode"`
  }
  _ = ctx.DecodeOptions(&opts)
  o.recorder.observed = opts.Mode
}
