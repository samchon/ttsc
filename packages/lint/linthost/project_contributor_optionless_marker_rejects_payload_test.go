package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectContributorOptionlessMarkerRejectsPayload verifies project rules
// share the contributor options capability at their global config boundary.
//
// ProjectContext exposes the same options transport as file-rule Context and
// therefore keeps the same default-compatible marker policy. An explicit false
// declaration must be honored before the project cycle starts, including for a
// globally configured rule.
//
//  1. Install a project contributor whose OptionsRule marker returns false.
//  2. Configure it globally with an object payload.
//  3. Assert engine construction reports the optionless payload.
//
// @evidence contracts/testing.md#behavioral-verification Actual Engine configuration rejects typo:true options for a project contributor explicitly declining options, while the same contributor without a payload has a declared error-severity binding and no configuration error.
// @evidence contracts/testing.md#independent-expectations Literal false capability and contextual rule does not accept options error independently define rejection; authored payload-free declared/error settings supply the positive binding oracle.
// @evidence contracts/testing.md#distinguishing-cases Object payload versus absence isolates option validation from unconditional contributor rejection; separate unmarked and generic-method units exercise legacy acceptance.
// @evidence contracts/testing.md#execution-ownership Actual project inspection and Engine construction execute directly in-process with previous registry restoration; this unit does not invoke rejected project Check, compile native sources or install a consumer.
func TestProjectContributorOptionlessMarkerRejectsPayload(t *testing.T) {
  adapter, err := inspectProjectContributor(optionlessProjectContributor{})
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
      adapter.name: json.RawMessage(`{"typo":true}`),
    },
  })
  err = engine.ConfigError()
  if err == nil || !strings.Contains(err.Error(), `rule does not accept options`) {
    t.Fatalf("optionless project contributor payload was not rejected: %v", err)
  }
  valid := NewEngineWithResolver(InlineRuleResolver{Rules: RuleConfig{adapter.name: SeverityError}})
  if err := valid.ConfigError(); err != nil || !valid.projectSettings[adapter.name].Declared || valid.projectSettings[adapter.name].Severity != SeverityError { t.Fatalf("optionless project contributor without payload should bind: %v / %v", err, valid.projectSettings) }
}

type optionlessProjectContributor struct{}

func (optionlessProjectContributor) Name() string                     { return "project-test/optionless-contract" }
func (optionlessProjectContributor) Check(*publicrule.ProjectContext) {}
func (optionlessProjectContributor) AcceptsTtscLintOptions() bool     { return false }
