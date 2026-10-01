package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorReportRelatedReachesFinding verifies a contributor's
// ctx.ReportRelated travels the whole chain — public Context, the contextReporter
// bridge, the engine Context — onto Finding.RelatedInformation, and that
// findingToLSPDiagnostic then renders it as an LSP relatedInformation entry
// carrying the finding's own file URI.
//
// The adapter bridge is the fragile link: it hides the RelatedReporter extension
// unless it forwards it, exactly as it must for the fix and tag extensions. A
// silently dropped forward would leave the diagnostic intact but strip the
// related location, so this asserts the location both reaches the finding and
// survives the LSP render.
//
// @evidence contracts/testing.md#behavioral-verification Real public related reporting survives contributor adaptation into one warning finding with literal 0..12 location and messages, then LSP rendering preserves file:///virtual/test.ts and line-zero 0..12 related coordinates.
// @evidence contracts/testing.md#independent-expectations Authored const source, flagged/defined over here messages and manually specified statement byte bounds define expected data independently of both adapters. A literal URI and LSP coordinates strengthen the existing same-file helper comparison.
// @evidence contracts/testing.md#distinguishing-cases Nonnil single related entry and nonempty range distinguish lost enrichment from successful diagnostic-only dispatch; identity/severity/failure validation prevents recovered engine errors from masquerading as related output.
// @evidence contracts/testing.md#execution-ownership Actual inspected contributor adapter, Engine.Run and findingToLSPDiagnostic run in-process with cleanup; no native plugin build, installed CLI, language-server transport or editor participates.
func TestContributorReportRelatedReachesFinding(t *testing.T) {
  metadata, err := inspectContributor(relatedContributor{})
  if err != nil {
    t.Fatal(err)
  }
  registered.rules[metadata.name] = newContributorAdapter(metadata)
  t.Cleanup(func() { delete(registered.rules, metadata.name) })

  file := parseTS(t, "const x = 1;\n")
  findings := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"demo/related": SeverityWarn},
  }).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{"demo/related": SeverityWarn}, findings); err != nil { t.Fatal(err) }

  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  related := findings[0].RelatedInformation
  if len(related) != 1 {
    t.Fatalf("related location did not reach the finding: %v", related)
  }
  if related[0].Message != "defined over here" {
    t.Fatalf("related message lost: %q", related[0].Message)
  }
  if findings[0].Message != "flagged" || related[0].Pos != 0 || related[0].End != 12 { t.Fatalf("related diagnostic or source bounds changed: %+v", findings[0]) }

  diag := findingToLSPDiagnostic(findings[0])
  if len(diag.RelatedInformation) != 1 {
    t.Fatalf("render dropped the related location: %+v", diag.RelatedInformation)
  }
  entry := diag.RelatedInformation[0]
  if entry.Message != "defined over here" {
    t.Fatalf("render lost the message: %q", entry.Message)
  }
  if want := fileURL(file.FileName()); entry.Location.URI != want {
    t.Fatalf("related location must carry the finding's own file URI: want %q got %q", want, entry.Location.URI)
  }
  if entry.Location.Range.Start == entry.Location.Range.End {
    t.Fatalf("related range should be non-empty, got %+v", entry.Location.Range)
  }
  if entry.Location.URI != "file:///virtual/test.ts" || entry.Location.Range.Start.Line != 0 || entry.Location.Range.Start.Character != 0 || entry.Location.Range.End.Line != 0 || entry.Location.Range.End.Character != 12 { t.Fatalf("literal related URI/range lost: %+v", entry.Location) }
}

// relatedContributor reports one finding on the first statement it visits and
// attaches a related location spanning that statement.
type relatedContributor struct{}

func (relatedContributor) Name() string { return "demo/related" }

func (relatedContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableStatement}
}

func (relatedContributor) Check(ctx *rule.Context, node *shimast.Node) {
  ctx.ReportRelated(node, "flagged", rule.RelatedInformation{
    Pos:     node.Pos(),
    End:     node.End(),
    Message: "defined over here",
  })
}
