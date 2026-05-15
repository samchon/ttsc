package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextLegacyReporterDropsFixEdits verifies the
// graceful-degradation contract for hosts that implement only the
// two-method `Reporter` surface.
//
// The existing legacy-reporter test covers `ReportRangeFix`; this
// sibling pins the `ReportFix` half: when the host does NOT implement
// `FixReporter`, `ReportFix(node, msg, edits...)` falls back to the
// plain `Report(node, msg)` path. Without this assertion, a regression
// in the type-assertion site (`rule.go:178`) could leak panics into
// contributor unit tests that wire their own minimal reporters.
//
// 1. Construct a Context whose reporter implements ONLY Report and ReportRange.
// 2. Call `ReportFix` with one edit.
// 3. Assert the legacy `Report` path fired once and no panic occurred.
func TestPublicRuleContextLegacyReporterDropsFixEdits(t *testing.T) {
  reporter := &legacyOnlyReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, reporter)
  ctx.ReportFix(newDummyNode(t), "msg", rule.TextEdit{Pos: 0, End: 1, Text: ""})
  if reporter.reports != 1 {
    t.Fatalf("legacy Report should fire once on ReportFix downgrade, got %d", reporter.reports)
  }
}

type legacyOnlyReporter struct {
  reports int
  ranges  int
}

func (r *legacyOnlyReporter) Report(_ *shimast.Node, _ string) {
  r.reports++
}

func (r *legacyOnlyReporter) ReportRange(_, _ int, _ string) {
  r.ranges++
}
