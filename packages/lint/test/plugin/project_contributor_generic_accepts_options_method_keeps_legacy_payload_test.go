package linthost

import (
  "encoding/json"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectContributorGenericAcceptsOptionsMethodKeepsLegacyPayload verifies
// the project adapter ignores an unrelated generic options method.
//
// Project contributors share the public OptionsRule capability with file
// contributors. A pre-existing AcceptsOptions method must not accidentally opt
// a project rule out of its backward-compatible ProjectContext.Options payload.
//
//  1. Adapt a legacy project contributor with only AcceptsOptions returning false.
//  2. Configure and run a project cycle with an object payload.
//  3. Assert its generic method is ignored and Check decodes the payload.
func TestProjectContributorGenericAcceptsOptionsMethodKeepsLegacyPayload(t *testing.T) {
  contributor := &legacyGenericOptionsProjectContributor{}
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
    t.Fatalf("legacy generic method rejected project options: %v", err)
  }
  engine.Run(nil, nil)

  if contributor.genericMethodCalls != 0 {
    t.Fatalf("legacy AcceptsOptions method was treated as a project capability: calls=%d", contributor.genericMethodCalls)
  }
  if contributor.checkCalls != 1 || contributor.observedMode != "strict" {
    t.Fatalf("legacy project dispatch = calls %d mode %q, want 1 and strict", contributor.checkCalls, contributor.observedMode)
  }
}

type legacyGenericOptionsProjectContributor struct {
  genericMethodCalls int
  checkCalls         int
  observedMode       string
}

func (*legacyGenericOptionsProjectContributor) Name() string {
  return "compat-test/generic-accepts-options-project"
}
func (r *legacyGenericOptionsProjectContributor) AcceptsOptions() bool {
  r.genericMethodCalls++
  return false
}
func (r *legacyGenericOptionsProjectContributor) Check(ctx *publicrule.ProjectContext) {
  r.checkCalls++
  var options struct {
    Mode string `json:"mode"`
  }
  if err := ctx.DecodeOptions(&options); err == nil {
    r.observedMode = options.Mode
  }
}
