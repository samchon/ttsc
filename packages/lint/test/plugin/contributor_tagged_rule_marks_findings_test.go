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

  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  if len(findings[0].Tags) != 1 || findings[0].Tags[0] != rule.DiagnosticTagUnnecessary {
    t.Fatalf("tag did not reach the finding: %v", findings[0].Tags)
  }
}

// TestContributorWithoutTagMarkerLeavesFindingsUntagged is the negative twin: a
// rule that does not implement TaggedRule produces untagged findings.
//
// Most findings are neither unnecessary nor deprecated, so untagged is the
// default and must survive. If the plumbing tagged everything, a plain rule's
// findings would be greyed out — the editor telling authors correct code is
// unnecessary.
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

  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  if findings[0].Tags != nil {
    t.Fatalf("an untagged rule must not tag its findings, got %v", findings[0].Tags)
  }
}

// taggedContributor reports one finding on the first statement it visits and
// declares whatever tags it was built with. A nil tags slice makes it a rule
// that does not meaningfully implement the marker.
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
