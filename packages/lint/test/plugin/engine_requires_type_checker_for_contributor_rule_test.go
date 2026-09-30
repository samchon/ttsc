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
//
// @evidence contracts/testing.md#behavioral-verification Actual inspection of a contributor with no checker marker yields an adapter that the owning checker gate classifies as type-aware.
// @evidence contracts/testing.md#independent-expectations The public conservative default independently requires true for marker absence; the test queries the actual adapter rather than assuming a zero-value fixture or inferring checker allocation.
// @evidence contracts/testing.md#distinguishing-cases No TypeAwareRule method contrasts with separate explicit-true and explicit-false marker controls; inspection errors are rejected before classification.
// @evidence contracts/testing.md#execution-ownership Real contributor metadata inspection and checker classification execute in-process; this decision-only unit does not construct a Program or checker, native producer, installation or CLI.
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
