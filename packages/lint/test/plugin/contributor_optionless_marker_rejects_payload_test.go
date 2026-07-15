package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorOptionlessMarkerRejectsPayload verifies a third-party rule can
// opt out of the contributor API's backward-compatible options default.
//
// Contributors historically received arbitrary Context.Options, so omitting
// OptionsRule must remain permissive. A contributor that knows it is genuinely
// optionless can return false, letting the same engine gate reject user typos
// before its Check method runs.
//
//  1. Adapt a contributor whose OptionsRule marker returns false.
//  2. Configure it with an object payload.
//  3. Assert a configuration error and no enabled dispatch entry.
func TestContributorOptionlessMarkerRejectsPayload(t *testing.T) {
  metadata, err := inspectContributor(optionlessContributorRule{})
  if err != nil {
    t.Fatal(err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  engine := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{metadata.name: SeverityError},
    Options: RuleOptionsMap{
      metadata.name: json.RawMessage(`{"typo":true}`),
    },
  })
  err = engine.ConfigError()
  if err == nil || !strings.Contains(err.Error(), `rule does not accept options`) {
    t.Fatalf("optionless contributor payload was not rejected: %v", err)
  }
  if _, enabled := engine.EnabledRules()[metadata.name]; enabled {
    t.Fatalf("optionless contributor entered dispatch: %v", engine.EnabledRules())
  }
}

type optionlessContributorRule struct{}

func (optionlessContributorRule) Name() string { return "demo/optionless-contract" }
func (optionlessContributorRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (optionlessContributorRule) Check(*publicrule.Context, *shimast.Node) {}
func (optionlessContributorRule) AcceptsTtscLintOptions() bool             { return false }
