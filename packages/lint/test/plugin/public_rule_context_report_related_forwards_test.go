package linthost

import (
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportRelatedForwards verifies rule.Context.ReportRelated
// and ReportRangeRelated hand their related locations to a host that implements
// rule.RelatedReporter, without falling back to the plain diagnostic path.
//
// The related locations are the whole point of the call — a no-redeclare
// contributor that leads the reader to the first definition depends on them
// landing on the host. Like ReportFix, the forwarding hinges on an unexported
// type assertion in rule.go; this pins it so a refactor cannot silently
// downgrade the call to the diagnostic-only path.
//
//  1. Build a fake reporter implementing Reporter + RelatedReporter.
//  2. Call ReportRelated (node) and ReportRangeRelated (range) with one location.
//  3. Assert each fired its related method exactly once, payload preserved, with
//     no fallback to Report / ReportRange.
func TestPublicRuleContextReportRelatedForwards(t *testing.T) {
  reporter := &captureRelatedReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  related := []rule.RelatedInformation{
    {Pos: 3, End: 7, Message: "first defined here"},
  }

  ctx.ReportRelated(node, "already defined", related...)
  if reporter.reports != 0 || reporter.ranges != 0 {
    t.Fatalf("plain fallback fired for node path: reports=%d ranges=%d", reporter.reports, reporter.ranges)
  }
  if reporter.relatedCalls != 1 {
    t.Fatalf("ReportRelated should fire exactly once, got %d", reporter.relatedCalls)
  }
  if !reflect.DeepEqual(reporter.lastRelated, related) {
    t.Fatalf("related round-trip mismatch: want %+v, got %+v", related, reporter.lastRelated)
  }

  ctx.ReportRangeRelated(1, 4, "already defined", related...)
  if reporter.rangeRelatedCalls != 1 {
    t.Fatalf("ReportRangeRelated should fire exactly once, got %d", reporter.rangeRelatedCalls)
  }
  if reporter.reports != 0 || reporter.ranges != 0 {
    t.Fatalf("plain fallback fired for range path: reports=%d ranges=%d", reporter.reports, reporter.ranges)
  }
}

// captureRelatedReporter implements the legacy rule.Reporter surface plus the
// rule.RelatedReporter extension so the positive related path can be observed.
// The reverse — a reporter without RelatedReporter — is exercised by
// public_rule_context_report_related_falls_back_test.go via captureReporter.
type captureRelatedReporter struct {
  reports           int
  ranges            int
  relatedCalls      int
  rangeRelatedCalls int
  lastRelated       []rule.RelatedInformation
}

func (r *captureRelatedReporter) Report(*shimast.Node, string) { r.reports++ }

func (r *captureRelatedReporter) ReportRange(int, int, string) { r.ranges++ }

func (r *captureRelatedReporter) ReportRelated(_ *shimast.Node, _ string, related ...rule.RelatedInformation) {
  r.relatedCalls++
  r.lastRelated = append([]rule.RelatedInformation(nil), related...)
}

func (r *captureRelatedReporter) ReportRangeRelated(_, _ int, _ string, related ...rule.RelatedInformation) {
  r.rangeRelatedCalls++
  r.lastRelated = append([]rule.RelatedInformation(nil), related...)
}

// captureRelatedReporter must satisfy both surfaces for the forwarding assertion
// in rule.Context to select the related path.
var (
  _ rule.Reporter        = (*captureRelatedReporter)(nil)
  _ rule.RelatedReporter = (*captureRelatedReporter)(nil)
)
