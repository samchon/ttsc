package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// declarationOptOutContributor is a contributor rule that opts out of
// declaration files through the public marker.
type declarationOptOutContributor struct{}

func (declarationOptOutContributor) Name() string { return "demo/declaration-opt-out" }
func (declarationOptOutContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (declarationOptOutContributor) Check(ctx *rule.Context, node *shimast.Node) {
}
func (declarationOptOutContributor) VisitsDeclarationFiles() bool { return false }

// TestContributorRuleOptOutSkipsDeclarationFiles verifies the contributor
// adapter honors the public `rule.DeclarationFileRule` marker.
//
// A value-level contributor rule can return `false` to get the same
// declaration-file dispatch skip built-in value rules enjoy; the adapter
// must forward that answer instead of forcing the conservative default,
// or the public marker would be dead API.
//
// 1. Wrap a contributor rule whose marker returns false.
// 2. Ask the engine's declaration-file predicate.
// 3. Assert the adapter reports the skip.
func TestContributorRuleOptOutSkipsDeclarationFiles(t *testing.T) {
  adapter := contributorAdapter{inner: declarationOptOutContributor{}}
  if ruleVisitsDeclarationFiles(adapter) {
    t.Fatalf("contributor opt-out marker was ignored by the declaration-file predicate")
  }
}
