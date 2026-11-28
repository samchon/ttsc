package lspserver

import (
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "testing"

  "golang.org/x/sys/windows"
)

// TestLSPWorkspaceMetadataReadsLockedParent checks the Windows stat fallback
// against Node while the file is held open without data sharing.
//
//  1. Hold the authored file with an exclusive native handle.
//  2. Obtain Node's metadata while the handle is live.
//  3. Match that metadata using only the parent's named directory entry.
//
// @evidence contracts/testing.md#behavioral-verification The named parent query returns the locked file's real identity, size and timestamps and agrees with the wire comparison.
// @evidence contracts/testing.md#independent-expectations Node reads the metadata directly while a separate Windows handle owns the lock. The fixture's literal bytes establish its size independently.
// @evidence contracts/testing.md#distinguishing-cases An exclusive data handle need not block FILE_READ_ATTRIBUTES on every filesystem, so the fallback is exercised directly. The target and its neighbor differ.
// @evidence contracts/testing.md#execution-ownership The test closes its owned handle before the temporary directory is released and joins its Node reporter.
func TestLSPWorkspaceMetadataReadsLockedParent(t *testing.T) {
  node, err := exec.LookPath("node")
  if err != nil {
    t.Skip("Node is unavailable")
  }
  root := t.TempDir()
  file := filepath.Join(root, "go-env")
  neighbor := filepath.Join(root, "go-env-other")
  if err := os.WriteFile(file, []byte("bytes"), 0o600); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(neighbor, []byte("other bytes"), 0o600); err != nil {
    t.Fatal(err)
  }
  pointer, err := windows.UTF16PtrFromString(file)
  if err != nil {
    t.Fatal(err)
  }
  handle, err := windows.CreateFile(pointer, windows.GENERIC_READ, 0, nil, windows.OPEN_EXISTING, 0, 0)
  if err != nil {
    t.Fatal(err)
  }
  defer windows.CloseHandle(handle)
  report := exec.Command(node, "-e", `
const fs = require("node:fs");
const path = process.argv[1];
const stat = fs.statSync(path, {bigint: true});
process.stdout.write(JSON.stringify({
  path: Buffer.from(path).toString("base64"), kind: "stat", mode: Number(stat.mode),
  modified: String(stat.mtimeNs), changed: String(stat.ctimeNs),
  size: String(stat.size), device: String(stat.dev), inode: String(stat.ino)
}));
`, file)
  output, err := report.Output()
  if err != nil {
    t.Fatalf("Node metadata: %v", err)
  }
  var wire NativePluginWorkspaceFile
  if err := json.Unmarshal(output, &wire); err != nil {
    t.Fatal(err)
  }
  input, err := newPluginWorkspaceFile(wire)
  if err != nil {
    t.Fatal(err)
  }
  observed, ok := windowsWorkspaceParentMetadata(workspaceWindowsPath(file))
  if !ok || observed.size != 5 || !input.matchesWindowsMetadata(observed) {
    t.Fatalf("parent metadata = %#v, ok = %t; Node = %#v", observed, ok, wire)
  }
  other, ok := windowsWorkspaceParentMetadata(workspaceWindowsPath(neighbor))
  if !ok || input.matchesWindowsMetadata(other) {
    t.Fatal("the neighboring entry passed the target's proof")
  }
}
