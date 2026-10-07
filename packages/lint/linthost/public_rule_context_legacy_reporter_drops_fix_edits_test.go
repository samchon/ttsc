package linthost

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
// in the FixReporter type assertion inside Context.ReportFix could leak panics into
// contributor unit tests that wire their own minimal reporters.
//
// 1. Construct a Context whose reporter implements ONLY Report and ReportRange.
// 2. Call `ReportFix` with one edit.
// 3. Assert the legacy `Report` path fired once and no panic occurred.
//
// @evidence contracts/testing.md#behavioral-verification Public Context.ReportFix on a reporter lacking FixReporter preserves the original node/msg through one ordinary Report callback and invokes no unrelated range callback instead of panicking or dropping the diagnostic.
// @evidence contracts/testing.md#independent-expectations Legacy capability absence discards candidate edits while retaining the diagnostic. The independently authored node identity, msg and one-node/zero-range callback counts define the expected compatibility behavior.
// @evidence contracts/testing.md#distinguishing-cases A nonempty edit and active severity isolate missing capability from zero edits or disabled reporting; neighboring capable-reporter tests exercise the opposite branch. The unchanged ordinary reporter interface supplies the actual legacy shape.
// @evidence contracts/testing.md#execution-ownership Direct public Context methods call an observing implementation of the supported two-method Reporter in-process. No source-compatibility text check, native build, installation or internal host adapter is used as an oracle.
func TestPublicRuleContextLegacyReporterDropsFixEdits(t *testing.T) {
  reporter := &legacyOnlyReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  ctx.ReportFix(node, "msg", rule.TextEdit{Pos: 0, End: 1, Text: ""})
  if reporter.reports != 1 {
    t.Fatalf("legacy Report should fire once on ReportFix downgrade, got %d", reporter.reports)
  }
  if reporter.ranges != 0 || reporter.lastNode != node || reporter.lastMessage != "msg" {
    t.Fatalf("legacy node payload lost: %+v", reporter)
  }
}

type legacyOnlyReporter struct {
  reports     int
  ranges      int
  lastNode    *shimast.Node
  lastMessage string
}

func (r *legacyOnlyReporter) Report(node *shimast.Node, message string) {
  r.reports++
  r.lastNode, r.lastMessage = node, message
}

func (r *legacyOnlyReporter) ReportRange(_, _ int, _ string) {
  r.ranges++
}
