package linthost

import (
  "reflect"
  "testing"
)

// TestProjectInputSnapshotNormalizesWindowsCaseAndSeparators pins the
// case-insensitive identity rule independently of the host running this test.
//
// Windows paths that differ only by drive/directory case or slash spelling
// must own one watcher. Glob metacharacters remain intact while their directory
// spelling is normalized.
func TestProjectInputSnapshotNormalizesWindowsCaseAndSeparators(t *testing.T) {
  got := uniqueProjectInputPatternsForFilesystem([]string{
    `C:\Repo\Docs\Spec.md`,
    `c:/repo/docs/spec.md`,
    `C:\Repo\Api\**\*.JSON`,
    `c:/repo/api/**/*.json`,
  }, true)
  want := []string{
    "c:/repo/api/**/*.json",
    "c:/repo/docs/spec.md",
  }
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("Windows-normalized inputs = %#v, want %#v", got, want)
  }
}
