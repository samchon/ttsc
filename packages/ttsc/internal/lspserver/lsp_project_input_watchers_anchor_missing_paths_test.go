package lspserver

import (
  "path/filepath"
  "testing"
)

// TestProjectInputWatchersAnchorMissingPaths verifies dynamic registrations use
// an existing ancestor while retaining the missing path in the glob.
//
// The owned root exists while neither nested directory has been created. The
// descriptors preserve the declared suffixes under that root; this test does
// not install them in an editor or observe later directory creation.
//
//  1. Declare one exact file and one glob under missing nested directories.
//  2. Build the client watcher registrations before either directory exists.
//  3. Assert both use the project URI and preserve their missing path segments.
//
// @evidence contracts/testing.md#behavioral-verification Registrations for an exact file and a glob under missing nested directories use the project URI as base and preserve the missing path segments in the pattern.
// @evidence contracts/testing.md#independent-expectations Count two and both full pattern strings are authored literals. Expected base URI is produced by the same projectInputFileURI helper used by the watcher implementation, so this equality checks root selection without independently certifying URI encoding.
// @evidence contracts/testing.md#distinguishing-cases An exact file and a wildcard population have distinct missing nested suffixes under an existing owned root. Existing nested anchors, future creation delivery and editor matching are outside this test.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls actual projectInputFileWatchers against an owned fresh temporary root and absent nested path data. No substitute operation, sidecar, native child, installed consumer, editor or product host runs.
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
