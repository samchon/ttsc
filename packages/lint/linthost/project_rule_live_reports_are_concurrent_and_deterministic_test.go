package linthost

import (
  "fmt"
  "runtime"
  "sync/atomic"
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
//
// @evidence contracts/testing.md#behavioral-verification Actual AST-only worker dispatch visits all 32 files, deduplicates shared and parity reports into exactly three detached error findings sorted even/odd/shared, and excludes recovered execution failures.
// @evidence contracts/testing.md#independent-expectations Literal 32 callback arrivals and the authored three-message sequence independently define full population, deduplication and deterministic order. Explicit nonserial configuration prevents a serial fixture from certifying the concurrency lane.
// @evidence contracts/testing.md#distinguishing-cases Two earliest callbacks synchronize overlapping lifetimes when the native worker budget exceeds one CPU; one-CPU hosts retain all original messages/counts. The project fixture explicitly declines a checker so a conservative project default cannot silently force serial dispatch.
// @evidence contracts/testing.md#execution-ownership Real Engine workers and shared project reporter run in-process over parsed files with registration restoration; an atomic counter/channel provides synchronization without sleeps, native producer builds, installation or external hosts.
func TestProjectRuleLiveReportsAreConcurrentAndDeterministic(t *testing.T) {
  const (
    projectRuleName = "project-concurrency-test/project"
    fileRuleName    = "project-concurrency-test/reporter"
  )

  installProjectRuleTestDouble(t, projectRuleTestDouble{name: projectRuleName})
  projectAdapter := registeredProjectRules[projectRuleName]
  projectAdapter.declinesTypeChecker = true
  registeredProjectRules[projectRuleName] = projectAdapter
  var arrivals atomic.Int32
  release := make(chan struct{})
  installProjectResultFileRuleTestDouble(t, projectResultFileRuleTestDouble{
    name: fileRuleName,
    check: func(ctx *publicrule.Context) {
      if arrival := arrivals.Add(1); runtime.NumCPU() > 1 && arrival <= 2 {
        if arrival == 2 { close(release) }
        <-release
      }
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
  engine := NewEngine(RuleConfig{
    projectRuleName: SeverityError,
    fileRuleName:    SeverityError,
  })
  if err := engine.ConfigError(); err != nil || engine.runsSerial() { t.Fatalf("concurrency fixture must select real AST-only workers: %v / serial=%v", err, engine.runsSerial()) }
  findings := engine.Run(files, nil)
  if got := arrivals.Load(); got != 32 { t.Fatalf("file dispatch count = %d, want 32", got) }

  if len(findings) != 3 {
    t.Fatalf("parallel reports should produce three project findings, got %#v", findings)
  }
  expected := []string{"even", "odd", "shared"}
  for i, message := range expected {
    if findings[i].File != nil || findings[i].Rule != projectRuleName || findings[i].Message != message || findings[i].Severity != SeverityError || findings[i].engineFailure {
      t.Fatalf("finding %d: want detached %q, got %#v", i, message, findings[i])
    }
  }
}
