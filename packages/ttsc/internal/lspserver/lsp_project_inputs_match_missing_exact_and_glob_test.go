package lspserver

import (
  "net/url"
  "path/filepath"
  "strings"
  "testing"
)

// TestProjectInputsMatchMissingExactAndGlob verifies URI matching consumes the
// declaration snapshot rather than the set of files that happened to exist.
//
// Supplied URI spellings for absent exact and globbed paths exercise direct
// matching before those files exist. Actual create/change/delete delivery is
// not executed. Unrelated files and remote URIs must not match.
//
//  1. Normalize one missing exact path, two zero-match globs and executable
//     reload paths, then assign that owned snapshot directly to a source.
//  2. Match URI spellings for future files without creating them.
//  3. Match only exact files, directory identity, or immediate topology
//     entries as executable-selection input scope.
//  4. Reject an unrelated Markdown file and an HTTPS resource.
//
// @evidence contracts/testing.md#behavioral-verification URI matching consumes the declaration snapshot: future files match a missing exact path and zero-match globs, reload scope matches only exact files, directory identity and immediate entries, and unrelated Markdown or an HTTPS resource do not match.
// @evidence contracts/testing.md#independent-expectations Expected matches are literal booleans per URI.
// @evidence contracts/testing.md#distinguishing-cases Six dependency rows separate exact, direct/nested JSON globs, literal bracket/brace segments, wildcard-looking nonliteral siblings and unrelated Markdown. Six legacy reload rows separate exact files, directory identity/immediate children, deeper descendants and sibling prefixes. HTTPS is rejected by both methods; digest-aware event routing and actual notification delivery are not exercised.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit calls actual normalization and URI membership operations against an owned empty temporary root and directly assigned source snapshot. It generates candidate URIs with net/url, creates none of the candidate files, and uses no substitute operation, native child, sidecar, installed consumer or product host.
func TestProjectInputsMatchMissingExactAndGlob(t *testing.T) {
  root := t.TempDir()
  publishedPath := func(location string) string {
    return filepath.ToSlash(realProjectInputPath(location))
  }
  snapshot, err := normalizeLSPProjectInputSnapshot(
    LSPProjectInputSnapshot{
      Root: publishedPath(root),
      Files: []string{
        publishedPath(filepath.Join(root, "docs", "missing.md")),
      },
      Globs: []string{
        publishedPath(filepath.Join(root, "api", "**", "*.json")),
        publishedPath(filepath.Join(
          root,
          "api",
          "**",
          "v[12]",
          "{openapi,swagger}.yaml",
        )),
      },
      ReloadDirectories: []string{
        publishedPath(filepath.Join(root, "config-deps")),
      },
      ReloadFiles: []string{
        publishedPath(filepath.Join(root, "lint.config.ts")),
      },
    },
    root,
  )
  if err != nil {
    t.Fatalf("normalize project input snapshot: %v", err)
  }
  source := &NativePluginSource{
    projectInputs: snapshot,
  }

  cases := []struct {
    location string
    want     bool
  }{
    {filepath.Join(root, "docs", "missing.md"), true},
    {filepath.Join(root, "api", "openapi.json"), true},
    {filepath.Join(root, "api", "nested", "swagger.json"), true},
    {
      filepath.Join(
        root,
        "api",
        "nested",
        "v[12]",
        "{openapi,swagger}.yaml",
      ),
      true,
    },
    {filepath.Join(root, "api", "nested", "v1", "openapi.yaml"), false},
    {filepath.Join(root, "README.md"), false},
  }
  for _, tc := range cases {
    uriPath := filepath.ToSlash(tc.location)
    if filepath.VolumeName(tc.location) != "" &&
      !strings.HasPrefix(uriPath, "/") {
      uriPath = "/" + uriPath
    }
    uri := (&url.URL{
      Scheme: "file",
      Path:   uriPath,
    }).String()
    if got := source.ProjectInputMatchesURI(uri); got != tc.want {
      t.Fatalf("ProjectInputMatchesURI(%q) = %v, want %v", uri, got, tc.want)
    }
  }
  if source.ProjectInputMatchesURI("https://example.com/openapi.json") {
    t.Fatal("remote URL matched the local filesystem dependency contract")
  }

  reloadCases := []struct {
    location string
    want     bool
  }{
    {filepath.Join(root, "lint.config.ts"), true},
    {filepath.Join(root, "config-deps"), true},
    {filepath.Join(root, "config-deps", "package.json"), true},
    {filepath.Join(root, "config-deps", "nested", "package.json"), false},
    {filepath.Join(root, "config-deps-other", "package.json"), false},
    {filepath.Join(root, "README.md"), false},
  }
  for _, tc := range reloadCases {
    uriPath := filepath.ToSlash(tc.location)
    if filepath.VolumeName(tc.location) != "" &&
      !strings.HasPrefix(uriPath, "/") {
      uriPath = "/" + uriPath
    }
    uri := (&url.URL{Scheme: "file", Path: uriPath}).String()
    if got := source.ProjectInputReloadMatchesURI(uri); got != tc.want {
      t.Fatalf(
        "ProjectInputReloadMatchesURI(%q) = %v, want %v",
        uri,
        got,
        tc.want,
      )
    }
  }
  if source.ProjectInputReloadMatchesURI("https://example.com/package.json") {
    t.Fatal("remote URL matched the executable reload contract")
  }
}
