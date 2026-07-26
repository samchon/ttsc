package linthost

import (
  "reflect"
  "testing"
)

// TestProjectInputSnapshotNormalizesWindowsSeparatorsWithoutFoldingCase
// verifies a producer does not erase a declaration before a filesystem-aware
// consumer can determine its identity.
//
// Windows directories may opt into case-sensitive lookup, so paths differing
// only by case can name different files. The producer normalizes separators and
// glob shape but preserves exact case; the consumer later converges aliases on
// ordinary case-insensitive directories.
//
//  1. Supply exact paths and globs with mixed case and separators.
//  2. Normalize them under Windows path rules.
//  3. Assert every case spelling survives in stable slash form.
func TestProjectInputSnapshotNormalizesWindowsSeparatorsWithoutFoldingCase(
  t *testing.T,
) {
  got := uniqueProjectInputPatternsForFilesystem([]string{
    `C:\Repo\Docs\Spec.md`,
    `c:/repo/docs/spec.md`,
    `C:\Repo\Api\**\*.JSON`,
    `c:/repo/api/**/*.json`,
  }, true)
  want := []string{
    "C:/Repo/Api/**/*.JSON",
    "C:/Repo/Docs/Spec.md",
    "c:/repo/api/**/*.json",
    "c:/repo/docs/spec.md",
  }
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("Windows-normalized inputs = %#v, want %#v", got, want)
  }
}
