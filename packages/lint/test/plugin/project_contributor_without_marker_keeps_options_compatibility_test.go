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
func TestProjectContributorWithoutMarkerKeepsOptionsCompatibility(t *testing.T) {
  adapter, err := inspectProjectContributor(compatibleProjectContributor{})
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
}

type compatibleProjectContributor struct{}

func (compatibleProjectContributor) Name() string { return "project-test/options-compatible" }
func (compatibleProjectContributor) Check(*publicrule.ProjectContext) {}
