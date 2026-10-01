package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// declarationDefaultContributor is a minimal contributor rule that does NOT
// implement the public DeclarationFileRule marker.
type declarationDefaultContributor struct{}

func (declarationDefaultContributor) Name() string { return "demo/declaration-default" }
func (declarationDefaultContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (declarationDefaultContributor) Check(ctx *rule.Context, node *shimast.Node) {
}

// TestContributorRulesVisitDeclarationFilesByDefault verifies the contributor
// adapter keeps third-party rules running on declaration files when they do
// not implement the public `rule.DeclarationFileRule` marker.
//
// The host cannot infer a third-party rule's grammar shape, so the adapter
// defaults conservatively — the same reasoning that keeps contributor rules
// on the checker path via `NeedsTypeChecker`. The policy is applied once in
// inspectContributor, so the test builds the adapter through the production
// construction path. A skip-by-default here would silently change existing
// contributor behavior on `.d.ts` inputs.
//
// 1. Inspect a contributor rule without the marker and wrap the metadata.
// 2. Ask the engine's declaration-file predicate.
// 3. Assert the adapter reports it visits declaration files.
//
// @evidence contracts/testing.md#behavioral-verification A contributor without the declaration marker is accepted by ruleVisitsDeclarationFiles after real metadata inspection and adaptation.
// @evidence contracts/testing.md#independent-expectations The public contributor contract conservatively defaults to visiting declarations when a marker is absent; the fixture deliberately implements no marker.
// @evidence contracts/testing.md#distinguishing-cases Absent marker is the positive case complementary to the explicit false opt-out test; the empty Check is not treated as evidence of dispatch execution.
// @evidence contracts/testing.md#execution-ownership Direct inspectContributor, newContributorAdapter and declaration predicate calls run in the shared Go process, without source walking, native contributor compilation or installation.
func TestContributorRulesVisitDeclarationFilesByDefault(t *testing.T) {
  metadata, err := inspectContributor(declarationDefaultContributor{})
  if err != nil {
    t.Fatalf("unexpected contributor inspection error: %v", err)
  }
  adapter := newContributorAdapter(metadata)
  if !ruleVisitsDeclarationFiles(adapter) {
    t.Fatalf("contributor rule without the marker must keep visiting declaration files")
  }
}
