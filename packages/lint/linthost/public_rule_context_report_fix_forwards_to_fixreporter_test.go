package linthost

import (
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportFixForwardsToFixReporter verifies contributor fix path.
//
// An observing FixReporter receives the public Context's node, message and
// ordered edit payload once, without ordinary Report fallback. This case
// establishes capability selection; it does not run the internal adapter or
// apply edits to a file.
//
//  1. Build a fake reporter implementing Reporter + FixReporter and capture every
//     invocation.
//  2. Call `ctx.ReportFix` with two non-overlapping edits through a public
//     rule.Context.
//  3. Assert the fixReporter received both edits in order with no fallback to
//     the diagnostic-only `Report` method.
//
// @evidence contracts/testing.md#behavioral-verification Public Context.ReportFix selects the available FixReporter exactly once and preserves the actual node, message and two authored edits in order, without invoking the ordinary Report fallback.
// @evidence contracts/testing.md#independent-expectations The literal msg, parsed fixture node identity and authored nonoverlapping edits supply expected callback payloads independently of the public context's delegation. Callback counts distinguish selecting the right capability from emitting duplicates.
// @evidence contracts/testing.md#distinguishing-cases Two edits with different ranges and replacement lengths expose truncation or reordering; an available FixReporter contrasts with zero-edit and legacy-host fallbacks covered by neighboring units.
// @evidence contracts/testing.md#execution-ownership A real public rule.Context invokes an observing reporter implementation directly in the Go process. The reporter captures arguments rather than implementing the forwarding decision, and this unit does not claim the internal host adapter or native linkage ran.
func TestPublicRuleContextReportFixForwardsToFixReporter(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  edits := []rule.TextEdit{
    {Pos: 0, End: 1, Text: "a"},
    {Pos: 5, End: 10, Text: "bcdef"},
  }
  ctx.ReportFix(node, "msg", edits...)
  if reporter.reports != 0 || reporter.ranges != 0 || reporter.rangeFixCall != 0 {
    t.Fatalf("Report fallback should not fire when FixReporter is available, got %d", reporter.reports)
  }
  if reporter.fixCalls != 1 {
    t.Fatalf("FixReporter.ReportFix should fire exactly once, got %d", reporter.fixCalls)
  }
  if !reflect.DeepEqual(reporter.lastEdits, edits) {
    t.Fatalf("edits round-trip mismatch: want %+v, got %+v", edits, reporter.lastEdits)
  }
  if reporter.lastNode != node || reporter.lastMessage != "msg" { t.Fatalf("fix diagnostic payload lost: %+v", reporter) }
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
  lastNode     *shimast.Node
  lastPos      int
  lastEnd      int
  lastMessage  string
}

func (r *captureReporter) Report(node *shimast.Node, message string) {
  r.reports++
  r.lastNode, r.lastMessage = node, message
}

func (r *captureReporter) ReportRange(pos, end int, message string) {
  r.ranges++
  r.lastPos, r.lastEnd, r.lastMessage = pos, end, message
}

func (r *captureReporter) ReportFix(node *shimast.Node, message string, edits ...rule.TextEdit) {
  r.fixCalls++
  r.lastNode, r.lastMessage = node, message
  r.lastEdits = append([]rule.TextEdit(nil), edits...)
}

func (r *captureReporter) ReportRangeFix(pos, end int, message string, edits ...rule.TextEdit) {
  r.rangeFixCall++
  r.lastPos, r.lastEnd, r.lastMessage = pos, end, message
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
