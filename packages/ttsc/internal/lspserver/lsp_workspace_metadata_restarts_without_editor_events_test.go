package lspserver

import (
  "encoding/base64"
  "os"
  "path/filepath"
  "runtime"
  "strconv"
  "testing"
)

// TestLSPWorkspaceMetadataRestartsWithoutEditorEvents verifies that a workspace
// selector has its own native polling lane on every host.
//
//  1. Admit the observed metadata of one ordinary external file.
//  2. Change only the fixture file without sending an editor event.
//  3. Require the live proxy to announce and return a selection restart.
//
// @evidence contracts/testing.md#behavioral-verification The proxy runs its actual polling loop against a changed native file.
// @evidence contracts/testing.md#independent-expectations The fixture supplies a literal file size and its independently observed modification time. Its written contents make the new file longer.
// @evidence contracts/testing.md#distinguishing-cases The unchanged file first validates and is absent from editor watch registrations.
// @evidence contracts/testing.md#execution-ownership The Go test owns the file and both ends of the simulated editor transport.
func TestLSPWorkspaceMetadataRestartsWithoutEditorEvents(t *testing.T) {
  root := t.TempDir()
  file := filepath.Join(root, "go-env")
  if err := os.WriteFile(file, []byte("first"), 0o600); err != nil {
    t.Fatal(err)
  }
  // Node reports writable permission on Windows and native permission on POSIX.
  mode := uint32(0o100600)
  if runtime.GOOS != "windows" {
    if err := os.Chmod(file, 0o600); err != nil {
      t.Fatal(err)
    }
  }
  info, err := os.Stat(file)
  if err != nil {
    t.Fatal(err)
  }
  selection := NativePluginSelectionInputs{WorkspaceFiles: []NativePluginWorkspaceFile{{
    Path: base64.StdEncoding.EncodeToString([]byte(file)), Kind: "stat", Mode: &mode,
    Size: "5", Modified: strconv.FormatInt(info.ModTime().UnixNano(), 10),
  }}}
  assertLSPRawPluginSelectionRestart(t, root, selection, func() {
    if err := os.WriteFile(file, []byte("second"), 0o600); err != nil {
      t.Fatal(err)
    }
  })
}
