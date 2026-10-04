package driver_test

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestReportRejectedConfigCandidatesResolvesDirectoryAlias Verifies a lexical
// alias is never published as a directory candidate's physical identity.
//
// Plugin discovery and the linked native plugin observe the same candidate in
// two stages. The JavaScript stage reports a realpath. If this Go stage reports
// the symlink spelling instead, the envelope merge drops the conflicting proof
// and cannot use that conflicting identity as a narrow-reuse proof. This unit
// observes the reporting callback, not adapter recompilation.
//
// 1. Prepare a physical directory and its symlink alias.
// 2. Resolve the physical candidate independently through filepath.EvalSymlinks.
// 3. Capture ReportRejectedConfigCandidates and require the physical identity.
//
// @evidence contracts/testing.md#behavioral-verification ReportRejectedConfigCandidates publishes a non-nil physical path equal to filepath.EvalSymlinks for the aliased directory candidate.
// @evidence contracts/testing.md#independent-expectations The independent filesystem symlink resolver supplies the physical identity oracle; the lexical alias must not stand in for that identity.
// @evidence contracts/testing.md#distinguishing-cases One directory candidate behind a native directory alias owns the distinction; preparation failures fail the case rather than certifying coverage through a skip.
// @evidence contracts/testing.md#execution-ownership Go test/driver calls the reporting operation with a captured callback and real directory fixture, without building a plugin or adapter.
func TestReportRejectedConfigCandidatesResolvesDirectoryAlias(t *testing.T) {
  root := t.TempDir()
  targetRoot := filepath.Join(root, "physical")
  target := filepath.Join(targetRoot, "demo.config.json")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  aliasRoot := filepath.Join(root, "alias")
  var aliasErr error
  if runtime.GOOS == "windows" {
    aliasErr = windowsjunction.Create(aliasRoot, targetRoot)
  } else {
    aliasErr = os.Symlink(targetRoot, aliasRoot)
  }
  if aliasErr != nil {
    t.Fatalf("prepare directory alias: %v", aliasErr)
  }
  alias := filepath.Join(aliasRoot, "demo.config.json")
  physical, err := filepath.EvalSymlinks(alias)
  if err != nil {
    t.Fatal(err)
  }

  var reported *string
  driver.ReportRejectedConfigCandidates(
    []driver.ConfigCandidate{{Directory: true, Path: alias}},
    nil,
    func(_ string, realpath *string) { reported = realpath },
  )

  if reported == nil {
    t.Fatalf("expected physical target %q, got no proof", physical)
  }
  if *reported != filepath.Clean(physical) {
    t.Fatalf("expected physical target %q, got %q", physical, *reported)
  }
}
