package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestEngineRequiresTypeCheckerForContributorRule verifies contributor rules
// stay on the conservative checker path.
//
// The public rule.Context exposes Checker and contributors have no mandatory
// AST-only marker. Treating them as checker-free would be a correctness risk
// for third-party rules that already read ctx.Checker.
//
// 1. Inspect a synthetic public contributor rule and wrap the metadata.
// 2. Ask the internal checker gate about that wrapped rule.
// 3. Assert the rule is treated as type-aware.
func TestEngineRequiresTypeCheckerForContributorRule(t *testing.T) {
  metadata, err := inspectContributor(contributorCheckerGateRule{})
  if err != nil {
    t.Fatalf("unexpected contributor inspection error: %v", err)
  }
  adapter := newContributorAdapter(metadata)
  if !ruleNeedsTypeChecker(adapter) {
    t.Fatal("contributor adapter did not request a type checker")
  }
}

type contributorCheckerGateRule struct{}

func (contributorCheckerGateRule) Name() string { return "demo/checker-gate" }
func (contributorCheckerGateRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (contributorCheckerGateRule) Check(*publicrule.Context, *shimast.Node) {}
