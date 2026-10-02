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
// The related locations are the whole point of the call; a no-redeclare
// contributor that leads the reader to the first definition depends on them
// landing on the host. Like ReportFix, the forwarding hinges on an unexported
// type assertion in rule.go; this pins it so a refactor cannot silently
// downgrade the call to the diagnostic-only path.
//
//  1. Build a fake reporter implementing Reporter + RelatedReporter.
//  2. Call ReportRelated (node) and ReportRangeRelated (range) with one location.
//  3. Assert each fired its related method exactly once, payload preserved, with
//     no fallback to Report / ReportRange.
//
// @evidence contracts/testing.md#behavioral-verification Public node and range related reports select their corresponding rich callbacks once, retain the diagnostic node/range/message and the full location list, and avoid ordinary fallback.
// @evidence contracts/testing.md#independent-expectations Literal messages and 1..4 diagnostic versus 3..7 related coordinates define different authored anchors; parsed node identity and exact callback counts specify the expected result independently of the observing reporter.
// @evidence contracts/testing.md#distinguishing-cases Both node and range routes are checked separately against nonempty related payloads. Legacy capability absence and empty locations have separate negative controls in the sibling fallback unit.
// @evidence contracts/testing.md#execution-ownership Real public Context calls run in-process against a payload-recording RelatedReporter. No contributor registration, native build, installed CLI or interface-source inspection is exercised.
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
  if reporter.lastNode != node || reporter.lastMessage != "already defined" || reporter.rangeRelatedCalls != 0 { t.Fatalf("node related diagnostic lost or misrouted: %+v", reporter) }

  ctx.ReportRangeRelated(1, 4, "already defined", related...)
  if reporter.rangeRelatedCalls != 1 {
    t.Fatalf("ReportRangeRelated should fire exactly once, got %d", reporter.rangeRelatedCalls)
  }
  if reporter.reports != 0 || reporter.ranges != 0 {
    t.Fatalf("plain fallback fired for range path: reports=%d ranges=%d", reporter.reports, reporter.ranges)
  }
  if reporter.relatedCalls != 1 || reporter.lastPos != 1 || reporter.lastEnd != 4 || reporter.lastMessage != "already defined" || !reflect.DeepEqual(reporter.lastRelated, related) { t.Fatalf("range related diagnostic or locations lost: %+v", reporter) }
}

// captureRelatedReporter implements the legacy rule.Reporter surface plus the
// rule.RelatedReporter extension so the positive related path can be observed.
// A reporter without RelatedReporter is exercised by
// public_rule_context_report_related_falls_back_test.go via captureReporter.
type captureRelatedReporter struct {
  reports           int
  ranges            int
  relatedCalls      int
  rangeRelatedCalls int
  lastRelated       []rule.RelatedInformation
  lastNode          *shimast.Node
  lastPos           int
  lastEnd           int
  lastMessage       string
}

func (r *captureRelatedReporter) Report(node *shimast.Node, message string) { r.reports++; r.lastNode, r.lastMessage = node, message }

func (r *captureRelatedReporter) ReportRange(pos, end int, message string) { r.ranges++; r.lastPos, r.lastEnd, r.lastMessage = pos, end, message }

func (r *captureRelatedReporter) ReportRelated(node *shimast.Node, message string, related ...rule.RelatedInformation) {
  r.relatedCalls++
  r.lastNode, r.lastMessage = node, message
  r.lastRelated = append([]rule.RelatedInformation(nil), related...)
}

func (r *captureRelatedReporter) ReportRangeRelated(pos, end int, message string, related ...rule.RelatedInformation) {
  r.rangeRelatedCalls++
  r.lastPos, r.lastEnd, r.lastMessage = pos, end, message
  r.lastRelated = append([]rule.RelatedInformation(nil), related...)
}

// captureRelatedReporter must satisfy both surfaces for the forwarding assertion
// in rule.Context to select the related path.
var (
  _ rule.Reporter        = (*captureRelatedReporter)(nil)
  _ rule.RelatedReporter = (*captureRelatedReporter)(nil)
)
