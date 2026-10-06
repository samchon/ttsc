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
// 2. Observe the authored physical candidate's kernel identity independently.
// 3. Capture ReportRejectedConfigCandidates and require the physical identity.
//
// @evidence contracts/testing.md#behavioral-verification ReportRejectedConfigCandidates publishes a non-nil physical path naming the independently statted authored directory, without the alias component. Nested aliases and retargeted aliases name their actual physical directory; missing and stale non-directory candidates cannot publish a directory realpath.
// @evidence contracts/testing.md#independent-expectations Authored target names and os.Stat/os.SameFile supply an independent kernel identity oracle; the product resolver does not produce the expected path. Native short/long spelling may differ while the reported path must omit the authored alias component.
// @evidence contracts/testing.md#distinguishing-cases Real Windows junctions or POSIX directory symlinks cover nested traversal and retargeting; regular directories, deleted candidates and stale directory classification have distinct reporting outcomes. Preparation failures fail rather than skip.
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
  assertTarget := func(candidate, expected string) {
    t.Helper()
    var reported *string
    driver.ReportRejectedConfigCandidates([]driver.ConfigCandidate{{Directory: true, Path: candidate}}, nil,
      func(_ string, realpath *string) { reported = realpath })
    if reported == nil {
      t.Fatalf("expected physical target %q, got no proof", expected)
    }
    want, err := os.Stat(expected)
    if err != nil {
      t.Fatal(err)
    }
    got, err := os.Stat(*reported)
    if err != nil {
      t.Fatal(err)
    }
    if !got.IsDir() || !os.SameFile(want, got) || filepath.Base(*reported) != filepath.Base(expected) ||
      filepath.Base(filepath.Dir(*reported)) != filepath.Base(filepath.Dir(expected)) {
      t.Fatalf("expected authored physical target %q, got %q", expected, *reported)
    }
  }
  assertTarget(alias, target)
  assertTarget(target, target)
  nestedRoot := filepath.Join(root, "nested")
  if runtime.GOOS == "windows" {
    aliasErr = windowsjunction.Create(nestedRoot, aliasRoot)
  } else {
    aliasErr = os.Symlink(aliasRoot, nestedRoot)
  }
  if aliasErr != nil {
    t.Fatal(aliasErr)
  }
  assertTarget(filepath.Join(nestedRoot, "demo.config.json"), target)
  replacementRoot := filepath.Join(root, "replacement")
  replacement := filepath.Join(replacementRoot, "demo.config.json")
  if err := os.MkdirAll(replacement, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Remove(aliasRoot); err != nil {
    t.Fatal(err)
  }
  if runtime.GOOS == "windows" {
    aliasErr = windowsjunction.Create(aliasRoot, replacementRoot)
  } else {
    aliasErr = os.Symlink(replacementRoot, aliasRoot)
  }
  if aliasErr != nil {
    t.Fatal(aliasErr)
  }
  assertTarget(alias, replacement)
  assertTarget(filepath.Join(nestedRoot, "demo.config.json"), replacement)
  for _, directory := range []bool{false, true} {
    calls := 0
    driver.ReportRejectedConfigCandidates([]driver.ConfigCandidate{{Directory: directory, Path: filepath.Join(root, "absent")}}, nil,
      func(_ string, realpath *string) {
        calls++
        if realpath != nil {
          t.Fatalf("absent candidate published %q", *realpath)
        }
      })
    expectedCalls := 1
    if directory {
      expectedCalls = 0
    }
    if calls != expectedCalls {
      t.Fatalf("directory=%v: realpath calls=%d, want %d", directory, calls, expectedCalls)
    }
  }
  if err := os.Remove(replacement); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(replacement, []byte("regular file"), 0o644); err != nil {
    t.Fatal(err)
  }
  calls := 0
  driver.ReportRejectedConfigCandidates([]driver.ConfigCandidate{{Directory: true, Path: alias}}, nil,
    func(_ string, _ *string) { calls++ })
  if calls != 0 {
    t.Fatal("stale directory classification published a regular file as directory identity")
  }
}
