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
// then let the checker gate select the AST-only lane. This unit observes that
// selection, not an actual checker allocation or parallel file walk.
//
//  1. Inspect an AST-only contributor whose marker returns false and wrap it.
//  2. Ask the internal checker gate about the wrapped rule.
//  3. Assert the rule is treated as AST-only (no checker requested).
//
// @evidence contracts/testing.md#behavioral-verification Actual inspection and adapter checker metadata preserve an explicit false NeedsTypeChecker marker; both the adapter query and owning checker gate classify the contributor as AST-only.
// @evidence contracts/testing.md#independent-expectations The authored false marker independently requires false at both metadata surfaces; this test does not infer actual checker allocation or parallel execution from that decision.
// @evidence contracts/testing.md#distinguishing-cases Explicit false contrasts with the sibling explicit-true rule; inspected real contributor metadata prevents testing an uninitialized adapter default instead of the marker.
// @evidence contracts/testing.md#execution-ownership Real metadata inspection and checker classification execute directly in-process; no program/checker allocation, native producer, installation or CLI is claimed.
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
