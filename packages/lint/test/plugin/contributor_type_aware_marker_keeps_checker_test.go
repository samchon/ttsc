package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorTypeAwareMarkerKeepsChecker is the negative twin of
// TestContributorAstOnlyMarkerLeavesCheckerPoolUnpinned: a contributor whose
// `rule.TypeAwareRule` marker returns true must stay on the checker path,
// exactly as if it had not implemented the marker at all. This pins the
// documented "returning true is equivalent to not implementing" boundary so an
// explicit true can never be misread as an opt-out.
//
// 1. Inspect a contributor whose marker returns true and wrap it.
// 2. Ask the internal checker gate about the wrapped rule.
// 3. Assert the rule is still treated as type-aware.
func TestContributorTypeAwareMarkerKeepsChecker(t *testing.T) {
  metadata, err := inspectContributor(contributorTypeAwareMarkerRule{})
  if err != nil {
    t.Fatalf("unexpected contributor inspection error: %v", err)
  }
  adapter := newContributorAdapter(metadata)
  if !adapter.NeedsTypeChecker() {
    t.Fatal("contributor with NeedsTypeChecker() == true was treated as AST-only")
  }
  if !ruleNeedsTypeChecker(adapter) {
    t.Fatal("contributor with an explicit type-aware marker did not request a checker")
  }
}

// contributorTypeAwareMarkerRule implements the marker but returns true, which
// must behave identically to omitting the marker.
type contributorTypeAwareMarkerRule struct{}

func (contributorTypeAwareMarkerRule) Name() string { return "demo/type-aware-marker" }
func (contributorTypeAwareMarkerRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (contributorTypeAwareMarkerRule) Check(*publicrule.Context, *shimast.Node) {}
func (contributorTypeAwareMarkerRule) NeedsTypeChecker() bool                   { return true }
