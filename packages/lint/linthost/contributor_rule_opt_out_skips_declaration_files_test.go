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
// A lint contributor rule can return `false` to get the same
// declaration-file dispatch skip built-in value rules enjoy; the marker
// answer is captured by inspectContributor and must reach the adapter
// through the production construction path, or the public marker would be
// dead API. A format adapter over that same captured false answer must
// still participate, since formatting takes precedence over this opt-out.
//
//  1. Inspect a contributor rule whose marker returns false and wrap the
//     metadata.
//  2. Ask the engine's declaration-file predicate.
//  3. Assert the lint adapter skips, while a format adapter with the same
//     false declaration answer still visits.
//
// @evidence contracts/testing.md#behavioral-verification inspectContributor and newContributorAdapter retain an explicit false VisitsDeclarationFiles marker, and the actual declaration predicate returns false for the ordinary adapter but true for the host format wrapper carrying that same false answer.
// @evidence contracts/testing.md#independent-expectations The authored contributor marker returns false independently of adapter construction; the ordinary adapter must preserve that public answer. The supported format precedence independently requires true for a format wrapper, rather than deriving the expected outcome from predicate output.
// @evidence contracts/testing.md#distinguishing-cases Explicit opt-out is the negative case paired with the marker-absent default acceptance test; a format wrapper over that captured false answer is the positive precedence boundary. This case does not claim to execute the contributor Check method.
// @evidence contracts/testing.md#execution-ownership Real metadata inspection, ordinary adapter construction, the host format wrapper and ruleVisitsDeclarationFiles calls run directly in one Go process, without registering or compiling a native contributor.
func TestContributorRuleOptOutSkipsDeclarationFiles(t *testing.T) {
  metadata, err := inspectContributor(declarationOptOutContributor{})
  if err != nil {
    t.Fatalf("unexpected contributor inspection error: %v", err)
  }
  adapter := newContributorAdapter(metadata)
  if ruleVisitsDeclarationFiles(adapter) {
    t.Fatalf("contributor opt-out marker was ignored by the declaration-file predicate")
  }
  formatted := formatContributorAdapter{contributorAdapter: adapter}
  if formatted.VisitsDeclarationFiles() || !ruleVisitsDeclarationFiles(formatted) {
    t.Fatal("format precedence must preserve the captured false marker while visiting declarations")
  }
}
