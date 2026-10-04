package lspserver

import (
  "path/filepath"
  "testing"
)

// TestProjectInputRegistrationShapesRelativePatterns verifies exact paths and
// glob populations become deduplicated LSP RelativePatterns without treating
// literal filename metacharacters as wildcards.
//
// Reload directories need two registrations: immediate children carry
// topology attention, while the exact directory identity represents deletion
// and replacement attention. This unit checks descriptors, not actual watcher
// delivery after native replacement.
//
//  1. Declare duplicate exact files, portable globs, and one reload directory.
//  2. Build and index the deduplicated relative-pattern registrations.
//  3. Assert literals are escaped while portable wildcard segments survive.
//  4. Assert reload-directory identity and immediate-child patterns both exist.
//  5. Assert drive and UNC file URIs preserve their authority and escaping.
//
// @evidence contracts/testing.md#behavioral-verification Actual watcher descriptors contain five deduplicated pattern strings with literal metacharacters escaped, wildcard segments preserved, and reload-directory identity plus child patterns. Two independent URI literals check drive escaping and UNC authority. Iteration order, complete base URIs and actual client matching are not asserted.
// @evidence contracts/testing.md#independent-expectations Five pattern strings, count five and two complete URI strings are authored literals. Watcher kind is compared with the declared all-events constant; base URI checks require nonempty values for the exact and JSON-glob lanes rather than independent full URI equality.
// @evidence contracts/testing.md#distinguishing-cases Duplicate exact/reload-file entries, literal star/question/bracket/brace filename characters, wildcard segments with literal bracket/brace segments, two reload-directory patterns, drive paths and UNC paths are covered. The test does not certify descriptor ordering or native watcher delivery.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit calls actual projectInputFileWatchers and projectInputFileURI in-process using an owned temporary root and authored path data. No substituted operation, native child, sidecar, installed consumer or product host runs; the filename with Windows-reserved characters is not materialized on disk.
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
      filepath.ToSlash(filepath.Join(
        root,
        "api",
        "**",
        "v[12]",
        "{openapi,swagger}.yaml",
      )),
    },
    ReloadDirectories: []string{
      filepath.ToSlash(filepath.Join(root, "config-deps")),
    },
    ReloadFiles: []string{
      filepath.ToSlash(exact),
    },
  }
  watchers := projectInputFileWatchers(snapshot)
  if len(watchers) != 5 {
    t.Fatalf("watchers = %#v, want 5 deduplicated entries", watchers)
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
  literalMetacharacters :=
    "api/**/v[[]12[]]/[{]openapi,swagger[}].yaml"
  if _, ok := byPattern[literalMetacharacters]; !ok {
    t.Fatalf("literal glob metacharacters were not escaped in %#v", byPattern)
  }
  if _, ok := byPattern["config-deps/*"]; !ok {
    t.Fatalf("reload-directory child watcher missing from %#v", byPattern)
  }
  if _, ok := byPattern["config-deps"]; !ok {
    t.Fatalf("reload-directory identity watcher missing from %#v", byPattern)
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
