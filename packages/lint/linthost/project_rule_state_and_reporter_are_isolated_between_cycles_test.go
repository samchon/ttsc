package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectRuleStateAndReporterAreIsolatedBetweenCycles verifies a new
// Engine.Run cycle reuses neither contributor state nor a live mutation channel.
//
// Public API callers may run two projects in one process, while watch and LSP
// repeatedly load new Programs. Each evaluation must therefore create a fresh
// state owner, and a result retained by contributor code must become inert as
// soon as its file dispatch finishes.
//
//  1. Capture one state and result from the first engine cycle.
//  2. Try to report after finalization and re-read that same cycle as clean.
//  3. Run a second cycle and assert fresh state with no leaked finding.
//
// @evidence contracts/testing.md#behavioral-verification Actual consecutive Engine runs each publish a distinct sequence-one/two state. After late Report and Fail on the first retained result, its original reader supplies a fresh passed snapshot with the same state and no findings; the second cycle also remains clean and passed.
// @evidence contracts/testing.md#independent-expectations Literal sequence counts, pointer inequality and empty findings independently define cycle isolation. A fresh snapshot from the original cycle after both late callbacks distinguishes actual reporter closure from an unchanged earlier snapshot or merely creating a fresh second cycle.
// @evidence contracts/testing.md#distinguishing-cases A retained first result attempts both report and explicit failure after closure; the same Engine and same parsed sources run again, distinguishing fresh cycle ownership from replacing the engine or input.
// @evidence contracts/testing.md#execution-ownership Actual project/file lifecycle runs twice in-process with restored registration and no native producer, watch process, installation or source-layout assertions.
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
  var firstContext *publicrule.Context
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: fileRuleName,
    check: func(ctx *publicrule.Context) {
      if firstContext == nil {
        firstContext = ctx
      }
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
  if len(observed) != 1 || firstContext == nil {
    t.Fatalf("observer should run in the first cycle, got %d calls", len(observed))
  }
  observed[0].Report("late result escaped its cycle")
  observed[0].Fail()
  closed := firstContext.ProjectResult(projectRuleName)
  if closed.Status != publicrule.ProjectRulePassed || closed.State != observed[0].State || len(closed.Findings) != 0 {
    t.Fatalf("late calls mutated the finalized first cycle: %#v", closed)
  }
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
  if checks != 2 || observed[0].Status != publicrule.ProjectRulePassed || observed[1].Status != publicrule.ProjectRulePassed || len(observed[1].Findings) != 0 { t.Fatalf("closed-cycle reporter mutated new state or result: checks=%d observed=%#v", checks, observed) }
}
