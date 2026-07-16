package linthost

import (
  "fmt"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectRuleLiveReportsAreConcurrentAndDeterministic verifies parallel
// file dispatch cannot race or reorder a live project result.
//
// AST-only contributor rules run across files concurrently. Their shared
// project reporter is host-owned, so equal messages must collapse atomically
// and distinct messages must be sorted independently of goroutine completion.
//
//  1. Run one AST-only reporter over many files in parallel.
//  2. Report one shared message and one parity message from every file.
//  3. Assert the final project findings contain three sorted messages once.
func TestProjectRuleLiveReportsAreConcurrentAndDeterministic(t *testing.T) {
  const (
    projectRuleName = "project-concurrency-test/project"
    fileRuleName    = "project-concurrency-test/reporter"
  )

  installProjectRuleTestDouble(t, projectRuleTestDouble{name: projectRuleName})
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: fileRuleName,
    check: func(ctx *publicrule.Context) {
      result := ctx.ProjectResult(projectRuleName)
      result.Report("shared")
      if ctx.File.FileName()[len(ctx.File.FileName())-4]%2 == 0 {
        result.Report("even")
      } else {
        result.Report("odd")
      }
    },
  })

  files := make([]*shimast.SourceFile, 0, 32)
  for i := range 32 {
    files = append(files, parseTSFile(
      t,
      fmt.Sprintf("/virtual/file-%02d.ts", i),
      fmt.Sprintf("export const value%d = %d;\n", i, i),
    ))
  }
  findings := NewEngine(RuleConfig{
    projectRuleName: SeverityError,
    fileRuleName:    SeverityError,
  }).Run(files, nil)

  if len(findings) != 3 {
    t.Fatalf("parallel reports should produce three project findings, got %#v", findings)
  }
  expected := []string{"even", "odd", "shared"}
  for i, message := range expected {
    if findings[i].File != nil || findings[i].Rule != projectRuleName || findings[i].Message != message {
      t.Fatalf("finding %d: want detached %q, got %#v", i, message, findings[i])
    }
  }
}
