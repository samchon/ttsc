package main

import (
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportFixForwardsToFixReporter verifies contributor fix path.
//
// The positive path of `rule.Context.ReportFix` — host implements `FixReporter`,
// contributor emits one or more edits, the edits land on the host with order and
// payload preserved — has no coverage today even though every contributor that
// ships a fixer depends on it. This test pins the contract so a future refactor
// of the unexported assertion site at `rule.go::ReportFix` cannot silently
// downgrade the call to the diagnostic-only path.
//
// 1. Build a fake reporter implementing Reporter + FixReporter and capture every
//    invocation.
// 2. Call `ctx.ReportFix` with two non-overlapping edits through a public
//    rule.Context.
// 3. Assert the fixReporter received both edits in order with no fallback to
//    the diagnostic-only `Report` method.
func TestPublicRuleContextReportFixForwardsToFixReporter(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, reporter)
  node := newDummyNode(t)
  edits := []rule.TextEdit{
    {Pos: 0, End: 1, Text: "a"},
    {Pos: 5, End: 10, Text: "bcdef"},
  }
  ctx.ReportFix(node, "msg", edits...)
  if reporter.reports != 0 {
    t.Fatalf("Report fallback should not fire when FixReporter is available, got %d", reporter.reports)
  }
  if reporter.fixCalls != 1 {
    t.Fatalf("FixReporter.ReportFix should fire exactly once, got %d", reporter.fixCalls)
  }
  if !reflect.DeepEqual(reporter.lastEdits, edits) {
    t.Fatalf("edits round-trip mismatch: want %+v, got %+v", edits, reporter.lastEdits)
  }
}

// captureReporter implements both the legacy `rule.Reporter` surface and the
// public `rule.FixReporter` extension so the positive fix path can be
// observed. The reverse — implementing only Reporter — is covered by
// public_rule_context_accepts_legacy_reporter_test.go.
type captureReporter struct {
  reports      int
  ranges       int
  fixCalls     int
  rangeFixCall int
  lastEdits    []rule.TextEdit
}

func (r *captureReporter) Report(_ *shimast.Node, _ string) {
  r.reports++
}

func (r *captureReporter) ReportRange(_, _ int, _ string) {
  r.ranges++
}

func (r *captureReporter) ReportFix(_ *shimast.Node, _ string, edits ...rule.TextEdit) {
  r.fixCalls++
  r.lastEdits = append([]rule.TextEdit(nil), edits...)
}

func (r *captureReporter) ReportRangeFix(_, _ int, _ string, edits ...rule.TextEdit) {
  r.rangeFixCall++
  r.lastEdits = append([]rule.TextEdit(nil), edits...)
}

// newDummyNode parses a one-statement TS source so the test has a real,
// non-nil shimast.Node to feed into ReportFix. The host nil-guards the
// node argument; passing nil would silently drop the call and mask
// regressions in the assertion site.
func newDummyNode(t *testing.T) *shimast.Node {
  t.Helper()
  file := parseTS(t, "var dummy = 1;\n")
  if file == nil || file.Statements == nil || len(file.Statements.Nodes) == 0 {
    t.Fatalf("expected one statement in fixture")
  }
  return file.Statements.Nodes[0]
}
