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
//
// @evidence contracts/testing.md#behavioral-verification The real inspected optionless adapter rejects literal typo:true options with the documented error and no enabled dispatch, while the same error-severity rule without options remains enabled.
// @evidence contracts/testing.md#independent-expectations The explicit false AcceptsTtscLintOptions marker independently disallows any authored options; literal error class and absent enabled entry specify rejection, while a payload-free configuration supplies positive identity/severity control.
// @evidence contracts/testing.md#distinguishing-cases Object payload versus no payload on the same contributor isolates the option capability gate; the legacy generic method and public option decoder have separate accepted-payload controls.
// @evidence contracts/testing.md#execution-ownership Real inspection, adapter construction and Engine configuration execute in-process with registry cleanup, without Check dispatch, native build, consumer installation or source-interface inspection.
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
  valid := NewEngineWithResolver(InlineRuleResolver{Rules: RuleConfig{metadata.name: SeverityError}})
  if err := valid.ConfigError(); err != nil || valid.EnabledRules()[metadata.name] != SeverityError { t.Fatalf("optionless contributor without payload should remain enabled: %v / %v", err, valid.EnabledRules()) }
}

type optionlessContributorRule struct{}

func (optionlessContributorRule) Name() string { return "demo/optionless-contract" }
func (optionlessContributorRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (optionlessContributorRule) Check(*publicrule.Context, *shimast.Node) {}
func (optionlessContributorRule) AcceptsTtscLintOptions() bool             { return false }
