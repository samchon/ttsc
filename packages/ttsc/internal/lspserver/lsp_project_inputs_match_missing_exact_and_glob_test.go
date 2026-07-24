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
//  1. Install one missing exact path and one JSON/YAML glob in a source.
//  2. Match URI spellings for future files without creating them.
//  3. Reject an unrelated Markdown file and an HTTPS resource.
func TestProjectInputsMatchMissingExactAndGlob(t *testing.T) {
  root := t.TempDir()
  source := &NativePluginSource{
    projectInputs: LSPProjectInputSnapshot{
      Root: filepath.ToSlash(root),
      Files: []string{
        filepath.ToSlash(filepath.Join(root, "docs", "missing.md")),
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
    },
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
