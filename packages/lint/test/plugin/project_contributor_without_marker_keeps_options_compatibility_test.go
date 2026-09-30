package linthost

import (
  "encoding/json"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectContributorWithoutMarkerKeepsOptionsCompatibility verifies the
// public ProjectContext options contract remains backward compatible.
//
// Existing contributor packages predate OptionsRule and cannot be identified
// as consumers from host source. The adapter therefore defaults to accepting
// options; only an explicit false marker opts into rejection.
//
//  1. Install a project contributor with no OptionsRule method.
//  2. Configure it globally with an object payload.
//  3. Assert engine construction accepts the existing contributor contract.
//
// @evidence contracts/testing.md#behavioral-verification Actual unmarked project contributor accepts its configured options and real project Check executes once, decoding mode strict through ProjectContext instead of dropping the payload.
// @evidence contracts/testing.md#independent-expectations Literal strict and one observed invocation independently specify backward-compatible delivery alongside the original ConfigError acceptance assertion.
// @evidence contracts/testing.md#distinguishing-cases Genuine absence of OptionsRule contrasts with the explicit optionless and unrelated generic-method units; populated payload and real Check distinguish acceptance from an inert declaration.
// @evidence contracts/testing.md#execution-ownership Real project inspection, Engine and public decoder execute an empty-source project cycle in-process with registration restoration; no native producer, CLI, consumer install or structural source inspection runs.
func TestProjectContributorWithoutMarkerKeepsOptionsCompatibility(t *testing.T) {
  contributor := &compatibleProjectContributor{}
  adapter, err := inspectProjectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  previous, existed := registeredProjectRules[adapter.name]
  registeredProjectRules[adapter.name] = adapter
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[adapter.name] = previous
    } else {
      delete(registeredProjectRules, adapter.name)
    }
  })

  engine := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{adapter.name: SeverityError},
    Options: RuleOptionsMap{
      adapter.name: json.RawMessage(`{"mode":"strict"}`),
    },
  })
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("unmarked project contributor lost options compatibility: %v", err)
  }
  engine.Run(nil, nil)
  if contributor.calls != 1 || contributor.mode != "strict" { t.Fatalf("unmarked contributor did not receive original options: calls=%d mode=%q", contributor.calls, contributor.mode) }
}

type compatibleProjectContributor struct { calls int; mode string }

func (*compatibleProjectContributor) Name() string { return "project-test/options-compatible" }
func (c *compatibleProjectContributor) Check(ctx *publicrule.ProjectContext) {
  c.calls++
  var options struct { Mode string `json:"mode"` }
  if err := ctx.DecodeOptions(&options); err == nil { c.mode = options.Mode }
}
