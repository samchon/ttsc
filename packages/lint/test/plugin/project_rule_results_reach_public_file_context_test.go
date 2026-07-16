package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type projectRuleTestDouble struct {
  name  string
  check func(*publicrule.ProjectContext)
}

func (r projectRuleTestDouble) Name() string { return r.name }
func (r projectRuleTestDouble) Check(ctx *publicrule.ProjectContext) {
  if r.check != nil {
    r.check(ctx)
  }
}

type projectResultFileRuleTestDouble struct {
  name  string
  check func(*publicrule.Context)
}

func (r projectResultFileRuleTestDouble) Name() string { return r.name }
func (r projectResultFileRuleTestDouble) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (r projectResultFileRuleTestDouble) Check(ctx *publicrule.Context, _ *shimast.Node) {
  if r.check != nil {
    r.check(ctx)
  }
}

func installProjectRuleTestDouble(t *testing.T, project projectRuleTestDouble) {
  t.Helper()
  previous, existed := registeredProjectRules[project.name]
  registeredProjectRules[project.name] = projectRuleAdapter{inner: project, name: project.name}
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[project.name] = previous
    } else {
      delete(registeredProjectRules, project.name)
    }
  })
}

func installProjectResultFileRuleTestDouble(t *testing.T, fileRule projectResultFileRuleTestDouble) {
  t.Helper()
  metadata := contributorMetadata{
    inner:                  fileRule,
    name:                   fileRule.name,
    visits:                 fileRule.Visits(),
    visitsDeclarationFiles: true,
  }
  previous, existed := registered.rules[fileRule.name]
  registered.rules[fileRule.name] = newContributorAdapter(metadata)
  t.Cleanup(func() {
    if existed {
      registered.rules[fileRule.name] = previous
    } else {
      delete(registered.rules, fileRule.name)
    }
  })
}

// TestProjectRuleResultsReachPublicFileContext verifies a contributor file rule
// observes every project-result state after project checks complete.
//
// A missing registration is not success, and an explicit off declaration is
// different from a registered rule that was never configured. The failed rule
// deliberately reports the same message twice so this test also pins the
// cycle-scoped reporter's deterministic deduplication. A panicking project
// check remains isolated as one deterministic failed result.
//
//  1. Install failed, off, not-evaluated, panicking, and passed project rules.
//  2. Run one public file contributor after the project cycle.
//  3. Assert all six states and two detached, deterministic project findings.
func TestProjectRuleResultsReachPublicFileContext(t *testing.T) {
  const (
    absentName       = "project-test/absent"
    failedName       = "project-test/failed"
    fileRuleName     = "project-test/file-observer"
    notEvaluatedName = "project-test/not-evaluated"
    offName          = "project-test/off"
    panickedName     = "project-test/panicked"
    passedName       = "project-test/passed"
  )

  installProjectRuleTestDouble(t, projectRuleTestDouble{
    name: failedName,
    check: func(ctx *publicrule.ProjectContext) {
      ctx.Fail()
      ctx.Report("project access rejected")
      ctx.Report("project access rejected")
    },
  })
  installProjectRuleTestDouble(t, projectRuleTestDouble{name: offName})
  installProjectRuleTestDouble(t, projectRuleTestDouble{name: notEvaluatedName})
  installProjectRuleTestDouble(t, projectRuleTestDouble{
    name: panickedName,
    check: func(*publicrule.ProjectContext) {
      panic("project check boom")
    },
  })
  installProjectRuleTestDouble(t, projectRuleTestDouble{name: passedName})

  observed := map[string]publicrule.ProjectRuleResult{}
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: fileRuleName,
    check: func(ctx *publicrule.Context) {
      for _, name := range []string{absentName, failedName, notEvaluatedName, offName, panickedName, passedName} {
        observed[name] = ctx.ProjectResult(name)
      }
      for _, name := range []string{absentName, notEvaluatedName, offName} {
        observed[name].Report("inactive result must stay inert")
      }
      ctx.Report(ctx.File.AsNode(), "file observer ran")
    },
  })

  engine := NewEngine(RuleConfig{
    failedName:   SeverityError,
    fileRuleName: SeverityError,
    offName:      SeverityOff,
    panickedName: SeverityError,
    passedName:   SeverityWarn,
  })
  findings := engine.Run([]*shimast.SourceFile{parseTS(t, "export const value = 1;\n")}, nil)

  expected := map[string]publicrule.ProjectRuleStatus{
    absentName:       publicrule.ProjectRuleAbsent,
    failedName:       publicrule.ProjectRuleFailed,
    notEvaluatedName: publicrule.ProjectRuleNotEvaluated,
    offName:          publicrule.ProjectRuleOff,
    panickedName:     publicrule.ProjectRuleFailed,
    passedName:       publicrule.ProjectRulePassed,
  }
  for name, status := range expected {
    if got := observed[name].Status; got != status {
      t.Fatalf("ProjectResult(%q): want %q, got %q", name, status, got)
    }
  }
  for _, name := range []string{absentName, notEvaluatedName, offName} {
    result := observed[name]
    if result.State != nil || len(result.Findings) != 0 {
      t.Fatalf("inactive ProjectResult(%q) exposed state or findings: %#v", name, result)
    }
  }
  if got := len(observed[failedName].Findings); got != 1 {
    t.Fatalf("failed result should retain one deduplicated finding, got %d", got)
  }
  panicked := observed[panickedName]
  if got := len(panicked.Findings); got != 1 || panicked.Findings[0].Message != `Project rule "project-test/panicked" panicked while checking this Program: project check boom. Report this to the rule's author.` {
    t.Fatalf("panicking result should retain one deterministic finding: %#v", panicked.Findings)
  }
  if got := len(findings); got != 3 || findings[0].File != nil || findings[0].Rule != failedName || findings[1].File != nil || findings[1].Rule != panickedName || findings[2].File == nil || findings[2].Rule != fileRuleName {
    t.Fatalf("project findings should be sorted before file findings: %#v", findings)
  }
}
