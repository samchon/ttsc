package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorTypeAwareMarkerKeepsChecker is the negative twin of
// TestContributorAstOnlyMarkerSkipsStandaloneChecker: a contributor whose
// `rule.TypeAwareRule` marker returns true must stay on the checker path,
// exactly as if it had not implemented the marker at all. This pins the
// documented "returning true is equivalent to not implementing" boundary so an
// explicit true can never be misread as an opt-out.
//
// 1. Inspect a contributor whose marker returns true and wrap it.
// 2. Ask the internal checker gate about the wrapped rule.
// 3. Assert the rule is still treated as type-aware.
//
// @evidence contracts/testing.md#behavioral-verification Actual inspection and adapter metadata preserve an explicit true NeedsTypeChecker marker; both adapter and checker gate continue requiring type-aware execution.
// @evidence contracts/testing.md#independent-expectations The authored true marker independently requires both Boolean decisions, preventing explicit opt-in from being misread as an AST-only opt-out.
// @evidence contracts/testing.md#distinguishing-cases Explicit true contrasts with the false-marker sibling; this decision-only unit does not claim that default marker absence or actual checker construction ran.
// @evidence contracts/testing.md#execution-ownership Real contributor metadata inspection and the owning checker gate execute in-process without allocating a Program, invoking a native build, installing consumers or probing source interfaces.
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
