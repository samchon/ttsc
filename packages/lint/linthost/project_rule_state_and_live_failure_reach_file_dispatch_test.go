package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectRuleStateAndLiveFailureReachFileDispatch verifies one evaluated
// project result stays live for the whole file-rule dispatch.
//
// A contributor must not reconstruct project ownership from a source filename
// or retain a process-global lifecycle map. The project check therefore binds
// one opaque state pointer, the first file helper rejects its guarded operation
// through the named result, and a later helper observes that failure.
//
//  1. Attach contributor-owned state while an enabled project rule passes.
//  2. Report one deduplicated project failure from the first file rule.
//  3. Assert a later file rule sees the same state and failed result.
//
// @evidence contracts/testing.md#behavioral-verification Actual project/file dispatch exposes the same state pointer first as passed, then as failed after a live report; duplicate messages collapse and final output preserves detached project error before dependent ordinary warning.
// @evidence contracts/testing.md#independent-expectations An authored binding pointer, literal status transitions/messages, one live failure and two ordered diagnostics independently define ownership and deduplication; severities distinguish project rejection from the dependent warning.
// @evidence contracts/testing.md#distinguishing-cases Two deterministically ordered file contributors isolate reporting before observation; duplicate identical reports test live deduplication without reconstructing state from a filename or process-global map.
// @evidence contracts/testing.md#execution-ownership Real Engine lifecycle and public Context.ProjectResult/reporting execute against restored in-process fixtures; no native plugin source build, consumer install, CLI transport or state-file oracle runs.
func TestProjectRuleStateAndLiveFailureReachFileDispatch(t *testing.T) {
  const (
    projectRuleName  = "project-live-test/project"
    reporterRuleName = "project-live-test/a-reporter"
    observerRuleName = "project-live-test/z-observer"
  )

  type projectBinding struct{ lifecycle string }
  binding := &projectBinding{lifecycle: "cycle-one"}
  installProjectRuleTestDouble(t, projectRuleTestDouble{
    name: projectRuleName,
    check: func(ctx *publicrule.ProjectContext) {
      ctx.SetState(binding)
    },
  })

  var reporterBefore publicrule.ProjectRuleResult
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: reporterRuleName,
    check: func(ctx *publicrule.Context) {
      reporterBefore = ctx.ProjectResult(projectRuleName)
      reporterBefore.Report("resource changed before guarded use")
      reporterBefore.Report("resource changed before guarded use")
    },
  })

  var observerAfter publicrule.ProjectRuleResult
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: observerRuleName,
    check: func(ctx *publicrule.Context) {
      observerAfter = ctx.ProjectResult(projectRuleName)
      if observerAfter.Status == publicrule.ProjectRuleFailed {
        ctx.Report(ctx.File.AsNode(), "dependent operation skipped")
      }
    },
  })

  engine := NewEngine(RuleConfig{
    projectRuleName:  SeverityError,
    reporterRuleName: SeverityError,
    observerRuleName: SeverityWarn,
  })
  findings := engine.Run(
    []*shimast.SourceFile{parseTS(t, "export const value = 1;\n")},
    nil,
  )

  if reporterBefore.Status != publicrule.ProjectRulePassed || reporterBefore.State != binding {
    t.Fatalf("reporter should receive the passed result and exact state: %#v", reporterBefore)
  }
  if observerAfter.Status != publicrule.ProjectRuleFailed || observerAfter.State != binding {
    t.Fatalf("observer should receive the failed result and exact state: %#v", observerAfter)
  }
  if got := len(observerAfter.Findings); got != 1 || observerAfter.Findings[0].Message != "resource changed before guarded use" {
    t.Fatalf("observer should receive one deduplicated live finding: %#v", observerAfter.Findings)
  }
  if got := len(findings); got != 2 || findings[0].File != nil || findings[0].Rule != projectRuleName || findings[1].File == nil || findings[1].Rule != observerRuleName {
    t.Fatalf("final project finding should precede file findings: %#v", findings)
  }
  if findings[0].Severity != SeverityError || findings[0].Message != "resource changed before guarded use" || findings[1].Severity != SeverityWarn || findings[1].Message != "dependent operation skipped" || findings[1].engineFailure { t.Fatalf("live failure or dependent diagnostic payload lost: %#v", findings) }
}
