package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextAcceptsLegacyReporter verifies contributor reporter compatibility.
//
// ReportFix is a new convenience on the public contributor Context, but the
// existing Reporter interface must remain source-compatible for contributor
// tests or helpers that implement only Report and ReportRange.
//
// 1. Construct a public rule.Context with a legacy two-method Reporter.
// 2. Call ReportRangeFix with one text edit.
// 3. Assert the diagnostic falls back to ReportRange instead of requiring a new method.
func TestPublicRuleContextAcceptsLegacyReporter(t *testing.T) {
  reporter := &legacyReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, reporter)
  ctx.ReportRangeFix(1, 2, "message", rule.TextEdit{Pos: 1, End: 2, Text: "x"})
  if reporter.ranges != 1 {
    t.Fatalf("legacy reporter should receive ReportRange fallback, got %d", reporter.ranges)
  }
}

type legacyReporter struct {
  ranges int
}

func (r *legacyReporter) Report(_ *shimast.Node, _ string) {}

func (r *legacyReporter) ReportRange(_, _ int, _ string) {
  r.ranges++
}
