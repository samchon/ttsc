package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "testing"
)

// TestContributorWithoutTagMarkerLeavesFindingsUntagged verifies a rule that
// supplies no tags, or does not implement TaggedRule, produces untagged
// findings. It is the negative twin of TestContributorTaggedRuleMarksFindings.
//
// Most findings are neither unnecessary nor deprecated, so untagged is the
// default and must survive. If the plumbing tagged everything, a plain rule's
// findings could be greyed out, telling authors correct code is
// unnecessary.
//
//  1. Run both a contributor returning nil tags and one lacking the optional tag marker on the same source.
//  2. Require one original-message untagged warning finding from each adapter.
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
  if err := validateSemanticRuleFindings(RuleConfig{"demo/tagged": SeverityWarn}, findings); err != nil {
    t.Fatal(err)
  }

  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  if findings[0].Tags != nil {
    t.Fatalf("an untagged rule must not tag its findings, got %v", findings[0].Tags)
  }
  if findings[0].Message != "flagged" {
    t.Fatalf("nil-tag contributor message lost: %q", findings[0].Message)
  }
  metadata, err = inspectContributor(untaggedContributor{})
  if err != nil {
    t.Fatal(err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  findings = NewEngine(RuleConfig{"demo/tagged": SeverityWarn}).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{"demo/tagged": SeverityWarn}, findings); err != nil {
    t.Fatal(err)
  }
  if len(findings) != 1 || findings[0].Tags != nil || findings[0].Message != "flagged" {
    t.Fatalf("absent tag capability must preserve an untagged real finding: %+v", findings)
  }
}
