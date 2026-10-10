package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorReportRelatedReachesFinding verifies a contributor's
// ctx.ReportRelated travels through public Context, the contextReporter
// bridge and engine Context onto Finding.RelatedInformation, and that
// findingToLSPDiagnostic then renders it as an LSP relatedInformation entry
// carrying the finding's own file URI.
//
// The adapter bridge is the fragile link: it hides the RelatedReporter extension
// unless it forwards it, exactly as it must for the fix and tag extensions. A
// silently dropped forward would leave the diagnostic intact but strip the
// related location, so this asserts the location both reaches the finding and
// survives the LSP render. A malformed related start and caller mutation after
// reporting distinguish real normalization and ownership from slice forwarding.
//
//  1. Adapt a contributor with an authored negative-start related location.
//  2. Run its real report and mutate the contributor-owned related storage.
//  3. Require the original bounded location and message in the finding and its
//     literal same-file LSP URI and coordinates.
//
// @evidence contracts/testing.md#behavioral-verification Real public related reporting bounds authored -5..12 coordinates to 0..12, preserves its original message after caller mutation and survives contributor adaptation into one warning finding; LSP rendering preserves file:///virtual/test.ts and line-zero 0..12 related coordinates.
// @evidence contracts/testing.md#independent-expectations Authored const source, flagged/defined over here messages and manually specified statement byte bounds define expected data independently of both adapters. A literal URI and LSP coordinates strengthen the existing same-file helper comparison.
// @evidence contracts/testing.md#distinguishing-cases Authored negative start and changed caller location distinguish normalization and copied storage from forwarding aliases; one related entry and literal same-file LSP coordinates distinguish lost enrichment, while semantic guards reject recovered engine errors.
// @evidence contracts/testing.md#execution-ownership Actual inspected contributor adapter, Engine.Run and findingToLSPDiagnostic run in-process with cleanup; no native plugin build, installed CLI, language-server transport or editor participates.
func TestContributorReportRelatedReachesFinding(t *testing.T) {
  contributor := relatedContributor{locations: []rule.RelatedInformation{{Pos: -5, End: 12, Message: "defined over here"}}}
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  file := parseTS(t, "const x = 1;\n")
  findings := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"demo/related": SeverityWarn},
  }).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{"demo/related": SeverityWarn}, findings); err != nil {
    t.Fatal(err)
  }

  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  if contributor.locations[0] != (rule.RelatedInformation{Pos: 99, End: 100, Message: "mutated after report"}) {
    t.Fatalf("caller storage mutation did not run: %+v", contributor.locations)
  }
  related := findings[0].RelatedInformation
  if len(related) != 1 {
    t.Fatalf("related location did not reach the finding: %v", related)
  }
  if related[0].Message != "defined over here" {
    t.Fatalf("related message lost: %q", related[0].Message)
  }
  if findings[0].Message != "flagged" || related[0].Pos != 0 || related[0].End != 12 {
    t.Fatalf("related diagnostic or source bounds changed: %+v", findings[0])
  }

  diag := findingToLSPDiagnostic(findings[0])
  if len(diag.RelatedInformation) != 1 {
    t.Fatalf("render dropped the related location: %+v", diag.RelatedInformation)
  }
  entry := diag.RelatedInformation[0]
  if entry.Message != "defined over here" {
    t.Fatalf("render lost the message: %q", entry.Message)
  }
  if want := fileURL(file.FileName().AsString()); entry.Location.URI != want {
    t.Fatalf("related location must carry the finding's own file URI: want %q got %q", want, entry.Location.URI)
  }
  if entry.Location.Range.Start == entry.Location.Range.End {
    t.Fatalf("related range should be non-empty, got %+v", entry.Location.Range)
  }
  if entry.Location.URI != "file:///virtual/test.ts" || entry.Location.Range.Start.Line != 0 || entry.Location.Range.Start.Character != 0 || entry.Location.Range.End.Line != 0 || entry.Location.Range.End.Character != 12 {
    t.Fatalf("literal related URI/range lost: %+v", entry.Location)
  }
}

// relatedContributor reports one finding on the first statement it visits and
// attaches authored related coordinates before mutating its own storage.
type relatedContributor struct {
  locations []rule.RelatedInformation
}

func (relatedContributor) Name() string { return "demo/related" }

func (relatedContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}

func (r relatedContributor) Check(ctx *rule.Context, node *shimast.Node) {
  ctx.ReportRelated(node, "flagged", r.locations...)
  r.locations[0] = rule.RelatedInformation{Pos: 99, End: 100, Message: "mutated after report"}
}
