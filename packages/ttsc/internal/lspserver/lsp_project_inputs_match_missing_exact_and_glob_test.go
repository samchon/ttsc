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
// Exact missing paths and zero-match glob populations must match future
// create/change/delete notifications. Unrelated files and remote URIs remain
// outside the filesystem contract.
//
//  1. Normalize one missing exact path and two zero-match globs as a producer
//     publishes them, then install that snapshot in a source.
//  2. Match URI spellings for future files without creating them.
//  3. Reject an unrelated Markdown file and an HTTPS resource.
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
}
