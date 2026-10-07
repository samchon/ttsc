package linthost

import (
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectContributorAstOnlyMarkerKeepsParallelWalk verifies a project
// contributor can decline the standalone checker.
//
// The checker decision is engine-wide. This entry binds a declared project
// contributor with an explicit false marker and checks that decision directly.
// It does not execute a walk or measure checker construction and runtime cost.
//
//  1. Install a project contributor whose marker returns false.
//  2. Configure it globally at error severity.
//  3. Assert the engine still skips the standalone checker.
//
// @evidence contracts/testing.md#behavioral-verification Actual inspection and project registration bind an explicit AST-only project contributor at declared error severity without unknown/configuration errors, and the Engine checker decision remains false.
// @evidence contracts/testing.md#independent-expectations The authored false NeedsTypeChecker marker independently specifies the engine-wide decision; explicit declared project settings prevent an unbound contributor from producing an accidental false result.
// @evidence contracts/testing.md#distinguishing-cases Declared enabled project binding contrasts with the sibling unmarked contributor checker requirement; this unit observes selection only, not a real parallel walk or measured checker allocation.
// @evidence contracts/testing.md#execution-ownership Actual inspectProjectContributor and Engine configuration run in-process with restoration of previous project registration; no Check execution, native compilation, installed consumer or repository layout assertion is claimed.
func TestProjectContributorAstOnlyMarkerKeepsParallelWalk(t *testing.T) {
  adapter, err := inspectProjectContributor(astOnlyProjectContributor{})
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
  if err := engine.ConfigError(); err != nil || len(engine.UnknownRules()) != 0 || !engine.projectSettings[adapter.name].Declared || engine.projectSettings[adapter.name].Severity != SeverityError {
    t.Fatalf("AST-only project contributor did not bind: %v / %v", err, engine.projectSettings)
  }
  if engine.NeedsTypeChecker() {
    t.Fatal("an AST-only project contributor forced the standalone checker")
  }
}

type astOnlyProjectContributor struct{}

func (astOnlyProjectContributor) Name() string                     { return "project-test/ast-only" }
func (astOnlyProjectContributor) Check(*publicrule.ProjectContext) {}
func (astOnlyProjectContributor) NeedsTypeChecker() bool           { return false }
