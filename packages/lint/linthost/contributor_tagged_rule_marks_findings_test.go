package linthost

import (
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorTaggedRuleMarksFindings verifies a rule.TaggedRule's
// classification reaches the findings it produces.
//
// Metadata inspection captures the contributor's classification, the adapter
// exposes it and the engine attaches it to the normal warning finding. This
// fixture exercises that chain; it does not execute an editor or prove a
// client's visual presentation. The stored tags remain immutable for the run.
//
//  1. Register a contributor that reports one finding and declares itself
//     Unnecessary.
//  2. Run it over a one-statement file.
//  3. Assert the finding carries the Unnecessary tag.
//
// @evidence contracts/testing.md#behavioral-verification Real contributor metadata, adapter and Engine dispatch preserve the unnecessary classification on one warning finding with its original flagged message.
// @evidence contracts/testing.md#independent-expectations The authored unnecessary enum and literal flagged message specify the expected classification independently of adapter storage; one finding and warning/error-failure validation require real successful dispatch.
// @evidence contracts/testing.md#distinguishing-cases A tagged contributor contrasts with nil-tag and genuinely absent-marker controls in the sibling unit; configuration warning severity distinguishes its normal finding from recovered engine error.
// @evidence contracts/testing.md#execution-ownership Actual inspection and in-process Engine execution over parsed TypeScript use registry cleanup; this unit owns tag stamping without native compilation, installed hosts or an editor.
func TestContributorTaggedRuleMarksFindings(t *testing.T) {
  metadata, err := inspectContributor(taggedContributor{tags: []rule.DiagnosticTag{rule.DiagnosticTagUnnecessary}})
  if err != nil {
    t.Fatal(err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  file := parseTS(t, "const x = 1;\n")
  findings := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"demo/tagged": SeverityWarn},
  }).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{"demo/tagged": SeverityWarn}, findings); err != nil { t.Fatal(err) }

  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  if len(findings[0].Tags) != 1 || findings[0].Tags[0] != rule.DiagnosticTagUnnecessary {
    t.Fatalf("tag did not reach the finding: %v", findings[0].Tags)
  }
  if findings[0].Message != "flagged" { t.Fatalf("tagged contributor message lost: %q", findings[0].Message) }
}

// taggedContributor reports one finding on the first statement it visits and
// declares whatever tags it was built with, including a nil tag result.
type taggedContributor struct {
  tags []rule.DiagnosticTag
}

func (taggedContributor) Name() string { return "demo/tagged" }

func (taggedContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}

func (t taggedContributor) DiagnosticTags() []rule.DiagnosticTag { return t.tags }

func (taggedContributor) Check(ctx *rule.Context, node *shimast.Node) {
  ctx.Report(node, "flagged")
}

// untaggedContributor owns the distinct absence-of-marker control.
type untaggedContributor struct{}
func (untaggedContributor) Name() string { return "demo/tagged" }
func (untaggedContributor) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableStatement} }
func (untaggedContributor) Check(ctx *rule.Context, node *shimast.Node) { ctx.Report(node, "flagged") }
