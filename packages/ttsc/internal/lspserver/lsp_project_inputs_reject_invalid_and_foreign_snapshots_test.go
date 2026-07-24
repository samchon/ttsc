package lspserver

import (
  "path/filepath"
  "testing"
)

// TestLSPProjectInputsRejectInvalidAndForeignSnapshots verifies the editor
// consumer enforces the same absolute-local, selected-root contract as the CLI
// watch consumer.
//
// The LSP manifest is an independent consumer of the sidecar protocol. It must
// reject malformed paths before a broad editor watcher can be redirected to an
// unrelated root or a Windows device namespace.
//
//  1. Normalize one valid snapshot under the selected physical root.
//  2. Reject relative paths, remote URLs, and a different project root.
//  3. Reject Windows device namespaces and malformed UNC volumes while
//     retaining fixed drive and UNC paths.
func TestLSPProjectInputsRejectInvalidAndForeignSnapshots(t *testing.T) {
  root := t.TempDir()
  valid := LSPProjectInputSnapshot{
    Root:  root,
    Files: []string{filepath.Join(root, "docs", "spec.md")},
    Globs: []string{filepath.Join(root, "api", "**", "*.json")},
  }
  normalized, err := normalizeLSPProjectInputSnapshot(valid, root)
  if err != nil {
    t.Fatalf("valid snapshot: %v", err)
  }
  if len(normalized.Files) != 1 || len(normalized.Globs) != 1 {
    t.Fatalf("normalized snapshot = %#v", normalized)
  }

  cases := []LSPProjectInputSnapshot{
    {Root: "relative", Files: []string{}, Globs: []string{}},
    {Root: root, Files: []string{"docs/spec.md"}, Globs: []string{}},
    {Root: root, Files: []string{}, Globs: []string{"https://example.com/openapi.json"}},
    {Root: filepath.Join(root, "foreign"), Files: []string{}, Globs: []string{}},
  }
  for _, snapshot := range cases {
    if _, err := normalizeLSPProjectInputSnapshot(snapshot, root); err == nil {
      t.Fatalf("invalid snapshot was accepted: %#v", snapshot)
    }
  }

  windowsCases := []struct {
    location string
    want     bool
  }{
    {location: `C:\project\docs\spec.md`, want: true},
    {location: `\\server\share\docs\spec.md`, want: true},
    {location: `\\?\C:\project\docs\spec.md`, want: true},
    {location: `\\?\UNC\server\share\docs\spec.md`, want: true},
    {location: `\root-only\docs\spec.md`, want: false},
    {location: "/root-only/docs/spec.md", want: false},
    {location: "\\\\server\\*\\docs\\spec.md", want: false},
    {location: "\\\\server\\..\\docs\\spec.md", want: false},
    {location: "\\\\?\\UNC\\server\\?\\docs\\spec.md", want: false},
    {location: "C:\\project\\docs\\spec.md\x00ignored", want: false},
    {location: `\\?\GLOBALROOT\Device\HarddiskVolume1`, want: false},
    {location: `\\.\pipe\ttsc`, want: false},
  }
  for _, tc := range windowsCases {
    if got := isAbsoluteLocalLSPProjectInputPath(tc.location, "windows"); got != tc.want {
      t.Fatalf(
        "isAbsoluteLocalLSPProjectInputPath(%q, windows) = %v, want %v",
        tc.location,
        got,
        tc.want,
      )
    }
  }
  if !isAbsoluteLocalLSPProjectInputPath("/project/docs/spec.md", "linux") {
    t.Fatal("POSIX absolute path was rejected under a non-Windows target")
  }
}
