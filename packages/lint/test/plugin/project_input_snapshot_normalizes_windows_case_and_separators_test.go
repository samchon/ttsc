package linthost

import (
  "reflect"
  "testing"
)

// TestProjectInputSnapshotNormalizesWindowsCaseAndSeparators verifies Windows
// path identity is stable independently of the host running this test.
//
// Windows paths that differ only by drive/directory case or slash spelling
// must own one watcher. Glob metacharacters remain intact while their directory
// spelling is normalized; otherwise one declared dependency can create duplicate
// watchers and rebuilds.
//
//  1. Supply exact paths and globs with mixed case and separators.
//  2. Normalize them under an explicitly case-insensitive filesystem.
//  3. Assert each physical dependency has one stable slash-form identity.
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
