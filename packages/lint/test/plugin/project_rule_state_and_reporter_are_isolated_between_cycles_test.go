package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectRuleStateAndReporterAreIsolatedBetweenCycles verifies neither
// contributor state nor its mutation channel survives an Engine.Run cycle.
//
// Public API callers may run two projects in one process, while watch and LSP
// repeatedly load new Programs. Each evaluation must therefore create a fresh
// state owner, and a result retained by contributor code must become inert as
// soon as its file dispatch finishes.
//
//  1. Capture one state and result from the first engine cycle.
//  2. Try to report through that result after the cycle has finalized.
//  3. Run a second cycle and assert fresh state with no leaked finding.
func TestProjectRuleStateAndReporterAreIsolatedBetweenCycles(t *testing.T) {
  const (
    projectRuleName = "project-isolation-test/project"
    fileRuleName    = "project-isolation-test/observer"
  )

  type projectBinding struct{ sequence int }
  checks := 0
  installProjectRuleTestDouble(t, projectRuleTestDouble{
    name: projectRuleName,
    check: func(ctx *publicrule.ProjectContext) {
      checks++
      ctx.SetState(&projectBinding{sequence: checks})
    },
  })

  var observed []publicrule.ProjectRuleResult
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: fileRuleName,
    check: func(ctx *publicrule.Context) {
      observed = append(observed, ctx.ProjectResult(projectRuleName))
    },
  })

  engine := NewEngine(RuleConfig{
    projectRuleName: SeverityError,
    fileRuleName:    SeverityError,
  })
  files := []*shimast.SourceFile{parseTS(t, "export const value = 1;\n")}
  if findings := engine.Run(files, nil); len(findings) != 0 {
    t.Fatalf("first clean cycle returned findings: %#v", findings)
  }
  if len(observed) != 1 {
    t.Fatalf("observer should run in the first cycle, got %d calls", len(observed))
  }
  observed[0].Report("late result escaped its cycle")
  if findings := engine.Run(files, nil); len(findings) != 0 {
    t.Fatalf("late report leaked into the next cycle: %#v", findings)
  }

  if len(observed) != 2 {
    t.Fatalf("observer should run once per cycle, got %d", len(observed))
  }
  first, firstOK := observed[0].State.(*projectBinding)
  second, secondOK := observed[1].State.(*projectBinding)
  if !firstOK || !secondOK || first == second || first.sequence != 1 || second.sequence != 2 {
    t.Fatalf("cycles should expose distinct state objects: first=%#v second=%#v", observed[0].State, observed[1].State)
  }
}
