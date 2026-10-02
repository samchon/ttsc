package linthost

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportSuggestionWithNoChoicesReports pins that an empty
// suggestion set degrades to a plain diagnostic rather than an empty choice
// menu, the same shape ReportFix takes when given no edits.
//
//  1. Invoke public ReportSuggestion with an available suggestion reporter and no choices.
//  2. Require one ordinary node/message diagnostic and no suggestion or unrelated range callback.
//
// @evidence contracts/testing.md#behavioral-verification Public suggestion reporting with no choices preserves the ordinary node/msg diagnostic exactly once and invokes neither node nor range suggestion capability.
// @evidence contracts/testing.md#independent-expectations An empty menu cannot offer a fix choice but does not remove the finding. Literal msg, parsed node identity and one-node/zero-other callback counts independently specify that downgrade.
// @evidence contracts/testing.md#distinguishing-cases An available SuggestionReporter and active severity isolate zero choices from missing capability or disabled reporting; the sibling nonempty-menu unit demonstrates this fixture's positive capability route.
// @evidence contracts/testing.md#execution-ownership Real public Context dispatches directly to an observing suggestion-capable reporter in-process without a native plugin build, installation, child host or source-layout assertion.
func TestPublicRuleContextReportSuggestionWithNoChoicesReports(t *testing.T) {
  reporter := &captureSuggestReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  ctx.ReportSuggestion(node, "msg")
  if reporter.suggestCalls != 0 {
    t.Fatalf("no suggestions must not open a choice menu, got %d suggestion calls", reporter.suggestCalls)
  }
  if reporter.reports != 1 {
    t.Fatalf("no suggestions must fall back to a plain diagnostic once, got %d", reporter.reports)
  }
  if reporter.ranges != 0 || reporter.rangeSuggest != 0 || reporter.lastNode != node || reporter.lastMessage != "msg" { t.Fatalf("empty suggestion diagnostic payload or route lost: %+v", reporter) }
}
