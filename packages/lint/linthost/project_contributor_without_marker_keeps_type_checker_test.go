package linthost

import (
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectContributorWithoutMarkerKeepsTypeChecker verifies the conservative
// default survives for a project contributor that says nothing.
//
// This is the negative twin of the AST-only case. The host cannot infer a
// third-party rule's shape, and ProjectContext carries a Checker, so an
// unmarked rule must keep receiving one. Losing this default would silently
// hand nil to every existing project contributor that reads Context.Checker —
// the marker exists to let a rule opt out, never to change what silence means.
//
//  1. Install a project contributor with no TypeAwareRule method.
//  2. Configure it globally at error severity.
//  3. Assert the engine still requests the standalone checker.
//
// @evidence contracts/testing.md#behavioral-verification Actual project contributor inspection and registration retain the conservative checker requirement for a declared error-severity contributor with no type-aware marker, rejecting config/unknown errors first.
// @evidence contracts/testing.md#independent-expectations The public no-marker default independently requires a true engine checker decision; literal declared/error settings establish that the actual project rule is bound before interpreting it.
// @evidence contracts/testing.md#distinguishing-cases Marker absence contrasts with the explicit AST-only sibling; actual declared settings distinguish default checker selection from an invalid or missing contributor registration.
// @evidence contracts/testing.md#execution-ownership Real project metadata inspection and Engine construction execute in-process with previous registration restoration; this unit checks the decision and does not claim checker allocation, project Check, native artifacts or installation.
func TestProjectContributorWithoutMarkerKeepsTypeChecker(t *testing.T) {
  adapter, err := inspectProjectContributor(unmarkedProjectContributor{})
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
  })
  if err := engine.ConfigError(); err != nil || len(engine.UnknownRules()) != 0 || !engine.projectSettings[adapter.name].Declared || engine.projectSettings[adapter.name].Severity != SeverityError { t.Fatalf("unmarked project contributor did not bind: %v / %v", err, engine.projectSettings) }
  if !engine.NeedsTypeChecker() {
    t.Fatal("an unmarked project contributor lost its standalone checker")
  }
}

type unmarkedProjectContributor struct{}

func (unmarkedProjectContributor) Name() string                     { return "project-test/unmarked-checker" }
func (unmarkedProjectContributor) Check(*publicrule.ProjectContext) {}
