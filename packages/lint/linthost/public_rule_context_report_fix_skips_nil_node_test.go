package linthost

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportFixSkipsNilNode verifies the nil-node guard
// at `rule.Context.ReportFix`.
//
// The host nil-checks the node before any reporter callback. A contributor
// that mistakenly passes nil (e.g., from a guarded `*ParameterDeclaration`
// pointer) must NOT see panics or spurious diagnostics — the guard at
// `rule.go::ReportFix` is the last line of defense before the reporter.
//
// 1. Construct a Context with a FixReporter-implementing reporter.
// 2. Call `ReportFix(nil, "msg", edit)`.
// 3. Assert no reporter method fired and no panic occurred.
//
// @evidence contracts/testing.md#behavioral-verification Public Context.ReportFix with a nil node invokes neither ordinary node/range reporting nor fix node/range reporting despite active severity, a capable reporter and a nonempty edit.
// @evidence contracts/testing.md#independent-expectations A node-anchored diagnostic requires a real node; the supplied edit cannot manufacture that missing diagnostic anchor. Literal zero counts across every reporter callback define the inert result independently of the implementation guard.
// @evidence contracts/testing.md#distinguishing-cases Active error severity and an available fix-capable reporter isolate nil-node rejection from disabled severity, missing reporter and zero-edit downgrade; the adjacent parsed-node positive case validates this reporter fixture.
// @evidence contracts/testing.md#execution-ownership The public method is called directly in-process on a real Context and observing reporter. The unit owns node-anchor guarding without native registration, artifact building, consumer installation or filesystem assertions.
func TestPublicRuleContextReportFixSkipsNilNode(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  ctx.ReportFix(nil, "msg", rule.TextEdit{Pos: 0, End: 1, Text: "x"})
  if reporter.reports != 0 || reporter.ranges != 0 ||
    reporter.fixCalls != 0 || reporter.rangeFixCall != 0 {
    t.Fatalf("nil node should drop the call silently, got reports=%d ranges=%d fix=%d rangefix=%d",
      reporter.reports, reporter.ranges, reporter.fixCalls, reporter.rangeFixCall)
  }
}
