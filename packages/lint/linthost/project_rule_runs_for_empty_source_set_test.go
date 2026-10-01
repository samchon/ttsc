package linthost

import (
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectRuleRunsForEmptySourceSet verifies project checks are not inferred
// from the first source-file dispatch.
//
// A valid Program may select zero user source files. Project checks still have
// a project identity and checker channel, so the engine must run the enabled
// rule exactly once and retain its detached finding.
//
//  1. Install one enabled project rule that records its source count.
//  2. Run the engine with an empty source slice.
//  3. Assert one check, zero sources, and one project finding with no file.
//
// @evidence contracts/testing.md#behavioral-verification Actual Engine project evaluation runs one enabled project callback despite no user sources, retains zero Sources, requests the conservative checker lane and collects one detached ordinary warning with the original message.
// @evidence contracts/testing.md#independent-expectations Literal one call, zero sources and empty project checked message independently specify empty-project behavior; warn severity and engineFailure absence distinguish the legitimate report from panic recovery.
// @evidence contracts/testing.md#distinguishing-cases No source-file callback can trigger this result; the detached finding and real project callback counts distinguish project execution from first-file dispatch, while sourceful project units cover populated cycles.
// @evidence contracts/testing.md#execution-ownership The actual Engine project lifecycle executes an in-process project-rule fixture with registration restoration and no supplied checker; checker requirement is observed as a decision, not as real allocation, native build or installation.
func TestProjectRuleRunsForEmptySourceSet(t *testing.T) {
  const name = "project-test/empty-program"
  calls := 0
  installProjectRuleTestDouble(t, projectRuleTestDouble{
    name: name,
    check: func(ctx *publicrule.ProjectContext) {
      calls++
      if len(ctx.Sources) != 0 {
        t.Fatalf("empty project exposed %d user sources", len(ctx.Sources))
      }
      ctx.Report("empty project checked")
    },
  })

  engine := NewEngine(RuleConfig{name: SeverityWarn})
  if !engine.NeedsTypeChecker() {
    t.Fatal("enabled project rule should request the Program checker")
  }
  findings := engine.Run(nil, nil)
  if calls != 1 {
    t.Fatalf("project rule should run once for an empty source set, got %d calls", calls)
  }
  if got := len(findings); got != 1 || findings[0].File != nil || findings[0].Rule != name {
    t.Fatalf("empty project should produce one detached finding, got %#v", findings)
  }
  if findings[0].Severity != SeverityWarn || findings[0].Message != "empty project checked" || findings[0].engineFailure { t.Fatalf("empty project did not preserve an ordinary warning: %+v", findings[0]) }
}
