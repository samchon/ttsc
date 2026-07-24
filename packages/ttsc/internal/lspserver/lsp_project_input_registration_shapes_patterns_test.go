package lspserver

import (
  "path/filepath"
  "testing"
)

// TestProjectInputRegistrationShapesRelativePatterns verifies exact paths and
// glob populations become deterministic LSP RelativePatterns without treating
// literal filename metacharacters as wildcards.
func TestProjectInputRegistrationShapesRelativePatterns(t *testing.T) {
  root := t.TempDir()
  exact := filepath.Join(
    root,
    "docs",
    "contract *?[v1]{draft} #%25.md",
  )
  snapshot := LSPProjectInputSnapshot{
    Root: filepath.ToSlash(root),
    Files: []string{
      filepath.ToSlash(exact),
      filepath.ToSlash(exact),
    },
    Globs: []string{
      filepath.ToSlash(filepath.Join(root, "api", "**", "*.json")),
    },
  }
  watchers := projectInputFileWatchers(snapshot)
  if len(watchers) != 2 {
    t.Fatalf("watchers = %#v, want 2 deduplicated entries", watchers)
  }

  byPattern := map[string]projectInputFileWatcher{}
  for _, watcher := range watchers {
    if watcher.Kind != watchedFileKindAll {
      t.Fatalf("watcher kind = %d, want %d", watcher.Kind, watchedFileKindAll)
    }
    byPattern[watcher.GlobPattern.Pattern] = watcher
  }
  literal := "docs/contract [*][?][[]v1[]][{]draft[}] #%25.md"
  if watcher, ok := byPattern[literal]; !ok {
    t.Fatalf("escaped exact pattern missing from %#v", byPattern)
  } else if watcher.GlobPattern.BaseURI == "" {
    t.Fatal("exact watcher has an empty base URI")
  }
  if watcher, ok := byPattern["api/**/*.json"]; !ok {
    t.Fatalf("glob pattern missing from %#v", byPattern)
  } else if watcher.GlobPattern.BaseURI == "" {
    t.Fatal("glob watcher has an empty base URI")
  }

  if got := projectInputFileURI("C:/Program Files/a#b%25"); got !=
    "file:///C:/Program%20Files/a%23b%2525" {
    t.Fatalf("drive URI = %q", got)
  }
  if got := projectInputFileURI("//server/share/a b#c"); got !=
    "file://server/share/a%20b%23c" {
    t.Fatalf("UNC URI = %q", got)
  }
}
