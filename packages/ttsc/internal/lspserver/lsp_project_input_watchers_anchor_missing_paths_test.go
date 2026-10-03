package lspserver

import (
  "path/filepath"
  "testing"
)

// TestProjectInputWatchersAnchorMissingPaths verifies dynamic registrations use
// an existing ancestor while retaining the missing path in the glob.
//
// Editors cannot reliably root a RelativePattern at a directory that does not
// exist yet. Anchoring at the physical project lets the registration observe
// later directory creation without broadening beyond the declared pattern.
//
//  1. Declare one exact file and one glob under missing nested directories.
//  2. Build the client watcher registrations before either directory exists.
//  3. Assert both use the project URI and preserve their missing path segments.
//
// @evidence contracts/testing.md#behavioral-verification Registrations for an exact file and a glob under missing nested directories use the project URI as base and preserve the missing path segments in the pattern.
// @evidence contracts/testing.md#independent-expectations The expected base URI and pattern segments are literals.
// @evidence contracts/testing.md#distinguishing-cases Both paths are missing, which is when a missing-directory root would be unobservable.
// @evidence contracts/testing.md#execution-ownership TestProjectInputWatchersAnchorMissingPaths is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestProjectInputWatchersAnchorMissingPaths(t *testing.T) {
  root := t.TempDir()
  watchers := projectInputFileWatchers(LSPProjectInputSnapshot{
    Root: root,
    Files: []string{
      filepath.Join(root, "docs", "missing", "spec.md"),
    },
    Globs: []string{
      filepath.Join(root, "api", "v1", "**", "*.json"),
    },
  })
  if len(watchers) != 2 {
    t.Fatalf("watchers = %#v", watchers)
  }
  wantBase := projectInputFileURI(root)
  patterns := map[string]bool{}
  for _, watcher := range watchers {
    if watcher.GlobPattern.BaseURI != wantBase {
      t.Fatalf(
        "watcher base = %q, want %q",
        watcher.GlobPattern.BaseURI,
        wantBase,
      )
    }
    patterns[watcher.GlobPattern.Pattern] = true
  }
  if !patterns["docs/missing/spec.md"] ||
    !patterns["api/v1/**/*.json"] {
    t.Fatalf("watcher patterns = %#v", patterns)
  }
}
