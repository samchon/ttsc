package driver

import "testing"

// TestTransformDependenciesWithdrawsCompletenessAfterAnUnusableDependency
// verifies a dependency the host could not key withdraws the claim it belonged
// to, instead of leaving a complete list with a member missing from it.
//
// The authored context first declares every file complete, then reports an
// empty dependency for src/main.ts. The returned complete list keeps only
// src/other.ts, which received no dependency report. No plugin lookup failure,
// consumer protocol, or successful dependency entry is exercised.
//
// @evidence contracts/testing.md#behavioral-verification A dependency the host could not key withdraws the completeness claim of that file only; the plugin's other files keep theirs.
// @evidence contracts/testing.md#independent-expectations The expected complete lists are literal file keys for the affected and unaffected files.
// @evidence contracts/testing.md#distinguishing-cases An empty dependency withdraws one file's prior all-file claim; the other file has no dependency report and remains complete.
// @evidence contracts/testing.md#execution-ownership This driver Go unit connects PluginContext reporting to its own declaration ledger and aggregates two literal keys. A temporary root supplies native path context; no files, compiler Program, installed consumer, or child process are created.
func TestTransformDependenciesWithdrawsCompletenessAfterAnUnusableDependency(t *testing.T) {
  cwd := t.TempDir()
  declarations := newPluginFileDeclarations()
  record := declarations.forPlugin(0)
  ctx := PluginContext{
    Cwd:                          cwd,
    reportFileDependency:         record.addDependency,
    reportFileDependencyRejected: record.rejectDependency,
    reportEveryFileComplete:      record.completeEveryFile,
  }

  ctx.ReportDependenciesComplete()
  ctx.ReportFileDependency("src/main.ts", "")

  out := aggregateTransformDependencies(
    []string{"src/main.ts", "src/other.ts"},
    []int{0},
    declarations,
  )

  if len(out.Complete) != 1 || out.Complete[0] != "src/other.ts" {
    t.Fatalf("expected only the unaffected file to stay complete, got %v", out.Complete)
  }
}
