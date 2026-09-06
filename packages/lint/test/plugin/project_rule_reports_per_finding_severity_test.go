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
    for _, finding := range result.Findings {
      if Severity(finding.Severity) != expected[finding.Message] {
        t.Fatalf("wrong snapshot severity: %#v", finding)
      }
    }
    for _, finding := range cycle.finalize() {
      if finding.Severity != expected[finding.Message] {
        t.Fatalf("wrong finalized severity: %#v", finding)
      }
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
}
