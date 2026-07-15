package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorAstOnlyMarkerSkipsStandaloneChecker verifies a syntactic
// contributor can opt out of the checker path through the public
// `rule.TypeAwareRule` marker.
//
// Contributor rules default to type-aware because the host cannot infer a
// third-party rule's shape. A contributor that never reads `ctx.Checker` can
// implement `NeedsTypeChecker() bool { return false }`; the engine gate must
// then keep the parallel file walk and avoid constructing a lint checker.
//
//  1. Inspect an AST-only contributor whose marker returns false and wrap it.
//  2. Ask the internal checker gate about the wrapped rule.
//  3. Assert the rule is treated as AST-only (no checker requested).
func TestContributorAstOnlyMarkerSkipsStandaloneChecker(t *testing.T) {
  metadata, err := inspectContributor(contributorAstOnlyMarkerRule{})
  if err != nil {
    t.Fatalf("unexpected contributor inspection error: %v", err)
  }
  adapter := newContributorAdapter(metadata)
  if adapter.NeedsTypeChecker() {
    t.Fatal("AST-only contributor adapter still reports NeedsTypeChecker() == true")
  }
  if ruleNeedsTypeChecker(adapter) {
    t.Fatal("AST-only contributor requested a standalone checker")
  }
}

// contributorAstOnlyMarkerRule is a syntactic contributor that opts out of the
// checker path through the public marker.
type contributorAstOnlyMarkerRule struct{}

func (contributorAstOnlyMarkerRule) Name() string { return "demo/ast-only-marker" }
func (contributorAstOnlyMarkerRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (contributorAstOnlyMarkerRule) Check(*publicrule.Context, *shimast.Node) {}
func (contributorAstOnlyMarkerRule) NeedsTypeChecker() bool                   { return false }
