package lspserver

import (
  "path/filepath"
  "testing"
)

// TestLSPProjectInputsRejectInvalidAndForeignSnapshots verifies the editor
// normalizer rejects the authored invalid snapshots and the explicit Windows
// path predicate distinguishes its supplied syntax rows. No CLI watcher runs.
//
// The LSP manifest is an independent consumer of the sidecar protocol. It must
// reject malformed paths before a broad editor watcher can be redirected to an
// unrelated root or a Windows device namespace.
//
//  1. Normalize one valid snapshot under the selected physical root.
//  2. Reject relative paths, remote URLs, and a different project root.
//  3. Reject Windows device namespaces and malformed UNC volumes while
//     retaining fixed drive and UNC paths.
//  4. Reject incomplete and malformed launcher-owned reload fingerprints.
//
// @evidence contracts/testing.md#behavioral-verification A selected-root snapshot retains one entry in each of four lists; supplied valid reload digests are accepted and preserved, while six invalid snapshots and three malformed fingerprint cases return errors. Separate explicit-Windows predicate calls distinguish twelve path-syntax rows, and one explicit-Linux absolute input is accepted. No actual watcher or cross-platform filesystem is exercised.
// @evidence contracts/testing.md#independent-expectations Counts, a literal 64-hex digest and boolean syntax outcomes are authored independently. Rejection assertions require an error without asserting its message; accepted list cardinalities do not certify every normalized path value or capture provenance of a supplied digest.
// @evidence contracts/testing.md#distinguishing-cases Valid and each invalid category are separate rows.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls normalizeLSPProjectInputSnapshot and isAbsoluteLocalLSPProjectInputPath. An owned temporary root permits real native ancestor/path and missing-reload observations; explicit windows/linux strings select predicate syntax only. It starts no child or product host, installs no consumer and substitutes no operation.
func TestLSPProjectInputsRejectInvalidAndForeignSnapshots(t *testing.T) {
  root := t.TempDir()
  valid := LSPProjectInputSnapshot{
    Root:              root,
    Files:             []string{filepath.Join(root, "docs", "spec.md")},
    Globs:             []string{filepath.Join(root, "api", "**", "*.json")},
    ReloadFiles:       []string{filepath.Join(root, "lint.config.ts")},
    ReloadDirectories: []string{filepath.Join(root, "config-deps")},
  }
  normalized, err := normalizeLSPProjectInputSnapshot(valid, root)
  if err != nil {
    t.Fatalf("valid snapshot: %v", err)
  }
  if len(normalized.Files) != 1 ||
    len(normalized.Globs) != 1 ||
    len(normalized.ReloadFiles) != 1 ||
    len(normalized.ReloadDirectories) != 1 {
    t.Fatalf("normalized snapshot = %#v", normalized)
  }
  const suppliedDigest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  fingerprinted := valid
  fingerprinted.ReloadFileDigests = map[string]string{valid.ReloadFiles[0]: suppliedDigest}
  fingerprinted.ReloadDirectoryDigests = map[string]string{valid.ReloadDirectories[0]: suppliedDigest}
  accepted, err := normalizeLSPProjectInputSnapshot(fingerprinted, root)
  if err != nil {
    t.Fatalf("valid supplied fingerprints: %v", err)
  }
  if len(accepted.ReloadFileDigests) != 1 || len(accepted.ReloadDirectoryDigests) != 1 {
    t.Fatalf("supplied fingerprint counts changed: %#v", accepted)
  }
  for _, digests := range []map[string]string{accepted.ReloadFileDigests, accepted.ReloadDirectoryDigests} {
    for _, digest := range digests {
      if digest != suppliedDigest {
        t.Fatalf("supplied fingerprint changed: %q", digest)
      }
    }
  }

  cases := []LSPProjectInputSnapshot{
    {Root: "relative", Files: []string{}, Globs: []string{}},
    {Root: root, Files: []string{"docs/spec.md"}, Globs: []string{}},
    {Root: root, Files: []string{}, Globs: []string{"https://example.com/openapi.json"}},
    {Root: root, ReloadFiles: []string{"lint.config.ts"}},
    {Root: root, ReloadDirectories: []string{"config-deps"}},
    {Root: filepath.Join(root, "foreign"), Files: []string{}, Globs: []string{}},
  }
  for _, snapshot := range cases {
    if _, err := normalizeLSPProjectInputSnapshot(snapshot, root); err == nil {
      t.Fatalf("invalid snapshot was accepted: %#v", snapshot)
    }
  }

  malformedFingerprintCases := []LSPProjectInputSnapshot{
    {
      Root:                   root,
      ReloadDirectories:      valid.ReloadDirectories,
      ReloadDirectoryDigests: map[string]string{},
    },
    {
      Root:              root,
      ReloadDirectories: valid.ReloadDirectories,
      ReloadDirectoryDigests: map[string]string{
        valid.ReloadDirectories[0]: "not-a-sha256-digest",
      },
    },
    {
      Root:              root,
      ReloadFiles:       valid.ReloadFiles,
      ReloadFileDigests: map[string]string{},
    },
  }
  for _, snapshot := range malformedFingerprintCases {
    if _, err := normalizeLSPProjectInputSnapshot(snapshot, root); err == nil {
      t.Fatalf("malformed selection fingerprint was accepted: %#v", snapshot)
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
