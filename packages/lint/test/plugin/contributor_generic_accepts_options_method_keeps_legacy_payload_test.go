package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorGenericAcceptsOptionsMethodKeepsLegacyPayload verifies the
// public options capability does not structurally capture an unrelated method.
//
// Go interfaces are structural, and contributor packages could already have
// defined the generic AcceptsOptions method for their own API. Only the
// domain-specific OptionsRule method may opt a contributor out of the legacy
// permissive default, or an existing false result would reject configurations
// that previously reached Context.Options.
//
//  1. Adapt a legacy file contributor with only AcceptsOptions returning false.
//  2. Configure and dispatch it with an object payload.
//  3. Assert its generic method is ignored and Check decodes the payload.
//
// @evidence contracts/testing.md#behavioral-verification A real adapted contributor with unrelated AcceptsOptions:false still receives and decodes mode strict exactly once, and the unrelated method is never invoked as a host capability.
// @evidence contracts/testing.md#independent-expectations Literal strict, one Check callback and zero generic calls independently define backward compatibility; the fixture records real dispatch and decoder results instead of reading adapter flags as its oracle.
// @evidence contracts/testing.md#distinguishing-cases A structurally tempting generic method returning false contrasts with the domain-specific optionless marker test; populated options and a real SourceFile callback distinguish accepted configuration from inert dispatch.
// @evidence contracts/testing.md#execution-ownership Actual contributor inspection, adapter and Engine.Run execute over a parsed source in-process with registration cleanup; no native producer, installed host or source-method existence assertion runs.
func TestContributorGenericAcceptsOptionsMethodKeepsLegacyPayload(t *testing.T) {
  contributor := &legacyGenericOptionsFileContributor{}
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  engine := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{metadata.name: SeverityError},
    Options: RuleOptionsMap{
      metadata.name: json.RawMessage(`{"mode":"strict"}`),
    },
  })
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("legacy generic method rejected contributor options: %v", err)
  }
  engine.Run([]*shimast.SourceFile{parseTS(t, "const value = 1;\n")}, nil)

  if contributor.genericMethodCalls != 0 {
    t.Fatalf("legacy AcceptsOptions method was treated as a host capability: calls=%d", contributor.genericMethodCalls)
  }
  if contributor.checkCalls != 1 || contributor.observedMode != "strict" {
    t.Fatalf("legacy contributor dispatch = calls %d mode %q, want 1 and strict", contributor.checkCalls, contributor.observedMode)
  }
}

type legacyGenericOptionsFileContributor struct {
  genericMethodCalls int
  checkCalls         int
  observedMode       string
}

func (*legacyGenericOptionsFileContributor) Name() string {
  return "compat-test/generic-accepts-options-file"
}
func (*legacyGenericOptionsFileContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (r *legacyGenericOptionsFileContributor) AcceptsOptions() bool {
  r.genericMethodCalls++
  return false
}
func (r *legacyGenericOptionsFileContributor) Check(ctx *publicrule.Context, _ *shimast.Node) {
  r.checkCalls++
  var options struct {
    Mode string `json:"mode"`
  }
  if err := ctx.DecodeOptions(&options); err == nil {
    r.observedMode = options.Mode
  }
}
