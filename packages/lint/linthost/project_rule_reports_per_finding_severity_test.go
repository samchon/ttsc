package linthost

import (
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectRuleReportsPerFindingSeverity verifies levels survive project
// result snapshots, deduplication, and final diagnostic conversion.
//
// A warning still means the project result is incomplete, while only errors
// fail the command. Equal messages keep the strongest reported level.
//
// 1. Report mixed levels, including an off finding and a duplicate.
// 2. Read the live result and finalize the cycle.
// 3. Assert severities, failed graph status, and the outer off gate.
//
// @evidence contracts/testing.md#behavioral-verification Actual project reporting inherits outer warn/error severity, respects explicit warn/error, removes off findings, upgrades duplicate messages to strongest severity, preserves three unique finalized detached diagnostics and marks even warning-only results failed.
// @evidence contracts/testing.md#independent-expectations Authored inherited/warning/duplicate labels and severity table independently define exact membership and levels; literal three findings, warning only message and failed status are compared without using reporter outputs to compute expectations.
// @evidence contracts/testing.md#distinguishing-cases Both outer severities, explicit off, duplicate error then warn, outer-off gate and warning-only cycle distinguish override, strongest-wins deduplication and graph incompleteness from command error severity.
// @evidence contracts/testing.md#execution-ownership Real project reporter, result snapshots and finalization execute directly in the shared Go process with restored test registration; no native producer, installed host or command-exit behavior is claimed.
func TestProjectRuleReportsPerFindingSeverity(t *testing.T) {
  const name = "severity-test/project"
  installProjectRuleTestDouble(t, projectRuleTestDouble{name: name, check: func(ctx *publicrule.ProjectContext) {
    ctx.Report("inherited")
    ctx.ReportSeverity(publicrule.SeverityWarn, "warning")
    ctx.ReportSeverity(publicrule.SeverityOff, "off")
    ctx.ReportSeverity(publicrule.SeverityError, "duplicate")
    ctx.ReportSeverity(publicrule.SeverityWarn, "duplicate")
  }})
  for _, outer := range []Severity{SeverityWarn, SeverityError} {
    cycle := NewEngine(RuleConfig{name: outer}).evaluateProject(publicrule.ProjectIdentity{}, nil, nil)
    result := cycle.results.ProjectResult(name)
    if result.Status != publicrule.ProjectRuleFailed || len(result.Findings) != 3 {
      t.Fatalf("unexpected result: %#v", result)
    }
    expected := map[string]Severity{"inherited": outer, "warning": SeverityWarn, "duplicate": SeverityError}
    seen := map[string]bool{}
    for _, finding := range result.Findings {
      severity, ok := expected[finding.Message]
      if !ok || seen[finding.Message] || Severity(finding.Severity) != severity {
        t.Fatalf("wrong snapshot severity: %#v", finding)
      }
      seen[finding.Message] = true
    }
    finalized := cycle.finalize()
    if len(finalized) != 3 { t.Fatalf("finalization lost or duplicated findings: %+v", finalized) }
    seen = map[string]bool{}
    for _, finding := range finalized {
      severity, ok := expected[finding.Message]
      if !ok || seen[finding.Message] || finding.Severity != severity || finding.Rule != name || finding.File != nil || finding.engineFailure {
        t.Fatalf("wrong finalized severity: %#v", finding)
      }
      seen[finding.Message] = true
    }
  }
  if findings := NewEngine(RuleConfig{name: SeverityOff}).Run(nil, nil); len(findings) != 0 {
    t.Fatalf("off rule reported: %#v", findings)
  }
  installProjectRuleTestDouble(t, projectRuleTestDouble{name: name, check: func(ctx *publicrule.ProjectContext) {
    ctx.ReportSeverity(publicrule.SeverityWarn, "warning only")
  }})
  cycle := NewEngine(RuleConfig{name: SeverityError}).evaluateProject(publicrule.ProjectIdentity{}, nil, nil)
  result := cycle.results.ProjectResult(name)
  if result.Status != publicrule.ProjectRuleFailed || len(result.Findings) != 1 || result.Findings[0].Severity != publicrule.SeverityWarn {
    t.Fatalf("warning-only result must remain incomplete: %#v", result)
  }
  if result.Findings[0].Message != "warning only" { t.Fatalf("warning-only message changed: %#v", result.Findings) }
}
