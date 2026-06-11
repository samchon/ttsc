package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// declarationDefaultContributor is a minimal contributor rule that does NOT
// implement the public DeclarationFileRule marker.
type declarationDefaultContributor struct{}

func (declarationDefaultContributor) Name() string           { return "demo/declaration-default" }
func (declarationDefaultContributor) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (declarationDefaultContributor) Check(ctx *rule.Context, node *shimast.Node) {
}

// TestContributorRulesVisitDeclarationFilesByDefault verifies the contributor
// adapter keeps third-party rules running on declaration files when they do
// not implement the public `rule.DeclarationFileRule` marker.
//
// The host cannot infer a third-party rule's grammar shape, so the adapter
// defaults conservatively — the same reasoning that keeps contributor rules
// on the checker path via `NeedsTypeChecker`. A skip-by-default here would
// silently change existing contributor behavior on `.d.ts` inputs.
//
// 1. Wrap a contributor rule without the marker in the adapter.
// 2. Ask the engine's declaration-file predicate.
// 3. Assert the adapter reports it visits declaration files.
func TestContributorRulesVisitDeclarationFilesByDefault(t *testing.T) {
  adapter := contributorAdapter{inner: declarationDefaultContributor{}}
  if !ruleVisitsDeclarationFiles(adapter) {
    t.Fatalf("contributor rule without the marker must keep visiting declaration files")
  }
}
