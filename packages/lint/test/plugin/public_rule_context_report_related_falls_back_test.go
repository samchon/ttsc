package linthost

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportRelatedFallsBack verifies the two degradations of
// ReportRelated / ReportRangeRelated: a host that does not implement
// rule.RelatedReporter, and a call with no related locations. Both must still
// deliver the diagnostic through the plain Report / ReportRange path — the
// related locations are an enrichment, never a precondition for the finding.
//
//  1. With related locations but a Reporter that lacks RelatedReporter, the call
//     falls back to Report / ReportRange.
//  2. With a RelatedReporter but zero related locations, the call still uses the
//     plain path rather than invoking the related method with an empty payload.
func TestPublicRuleContextReportRelatedFallsBack(t *testing.T) {
  related := []rule.RelatedInformation{{Pos: 0, End: 1, Message: "here"}}
  node := newDummyNode(t)

  // Case 1: legacy reporter without RelatedReporter — captureReporter implements
  // Reporter + FixReporter but not RelatedReporter.
  legacy := &captureReporter{}
  legacyCtx := rule.NewContext(nil, nil, rule.SeverityError, nil, legacy)
  legacyCtx.ReportRelated(node, "msg", related...)
  legacyCtx.ReportRangeRelated(0, 1, "msg", related...)
  if legacy.reports != 1 {
    t.Fatalf("node path should fall back to Report once, got %d", legacy.reports)
  }
  if legacy.ranges != 1 {
    t.Fatalf("range path should fall back to ReportRange once, got %d", legacy.ranges)
  }

  // Case 2: RelatedReporter present, but no related locations supplied.
  rich := &captureRelatedReporter{}
  richCtx := rule.NewContext(nil, nil, rule.SeverityError, nil, rich)
  richCtx.ReportRelated(node, "msg")
  richCtx.ReportRangeRelated(0, 1, "msg")
  if rich.relatedCalls != 0 || rich.rangeRelatedCalls != 0 {
    t.Fatalf("empty related must not invoke the related path: %d/%d", rich.relatedCalls, rich.rangeRelatedCalls)
  }
  if rich.reports != 1 || rich.ranges != 1 {
    t.Fatalf("empty related must use the plain path: reports=%d ranges=%d", rich.reports, rich.ranges)
  }
}
