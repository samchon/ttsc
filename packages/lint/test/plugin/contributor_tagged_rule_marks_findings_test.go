package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorTaggedRuleMarksFindings verifies a rule.TaggedRule's
// classification reaches the findings it produces.
//
// The tag is read at dispatch from the marker and copied onto every finding, so
// the whole chain — inspectContributor caches it, the adapter forwards it,
// dispatch stamps it — has to hold or an editor's greying never appears. The
// wrapping adapter is the fragile link: it hides an optional marker unless it
// forwards it explicitly, exactly as it must for NeedsTypeChecker.
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

// TestContributorWithoutTagMarkerLeavesFindingsUntagged is the negative twin: a
// rule that supplies no tags or does not implement TaggedRule produces
// untagged findings.
//
// Most findings are neither unnecessary nor deprecated, so untagged is the
// default and must survive. If the plumbing tagged everything, a plain rule's
// findings would be greyed out — the editor telling authors correct code is
// unnecessary.
//
// @evidence contracts/testing.md#behavioral-verification Both a contributor returning nil tags and a separate contributor that has no DiagnosticTags method produce one untagged warning finding with original flagged message.
// @evidence contracts/testing.md#independent-expectations Literal nil tag identity and successful warning finding are the independently required default; a nonnil empty classification or recovered error cannot satisfy the observation.
// @evidence contracts/testing.md#distinguishing-cases Original nil marker result is retained and contrasted with genuine marker absence on the same source and rule identity; the sibling nonempty-tag test provides the positive stamping control.
// @evidence contracts/testing.md#execution-ownership Real contributor inspections, adapter replacement and Engine dispatch execute directly in-process with registration cleanup; no structural source inspection, native artifact, consumer install or editor is used.
func TestContributorWithoutTagMarkerLeavesFindingsUntagged(t *testing.T) {
  metadata, err := inspectContributor(taggedContributor{tags: nil})
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
  if findings[0].Tags != nil {
    t.Fatalf("an untagged rule must not tag its findings, got %v", findings[0].Tags)
  }
  metadata, err = inspectContributor(untaggedContributor{})
  if err != nil { t.Fatal(err) }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  findings = NewEngine(RuleConfig{"demo/tagged": SeverityWarn}).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{"demo/tagged": SeverityWarn}, findings); err != nil { t.Fatal(err) }
  if len(findings) != 1 || findings[0].Tags != nil || findings[0].Message != "flagged" { t.Fatalf("absent tag capability must preserve an untagged real finding: %+v", findings) }
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
