package linthost

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestWindowsJunctionDependencyEntryMatchesNodeFingerprint verifies the Go
// cache validator reproduces Node's fingerprint for a Windows junction entry.
//
// Node classifies the reparse point as a symlink while Go's FileMode can report
// it as a directory. That vocabulary mismatch makes an unchanged executable
// config look stale on every cache lookup.
//
//  1. Create a privilege-free Windows directory junction.
//  2. Encode its target with the loader's `symlink\0<target>` contract.
//  3. Require the Go `entry` digest to reproduce that exact fingerprint.
func TestWindowsJunctionDependencyEntryMatchesNodeFingerprint(t *testing.T) {
  if runtime.GOOS != "windows" {
    t.Skip("Windows junction boundary")
  }
  root := t.TempDir()
  target := filepath.Join(root, "target")
  link := filepath.Join(root, "link")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := windowsjunction.Create(link, target); err != nil {
    t.Fatal(err)
  }
  linkTarget, err := os.Readlink(link)
  if err != nil {
    t.Fatalf("read junction target: %v", err)
  }
  h := sha256.New()
  h.Write([]byte("symlink\x00"))
  h.Write([]byte(linkTarget))
  want := hex.EncodeToString(h.Sum(nil))
  got, err := configDependencyDigest(configDependencyFingerprint{
    Path: link,
    Kind: configDependencyEntry,
  })
  if err != nil {
    t.Fatalf("digest junction entry: %v", err)
  }
  if got != want {
    t.Fatalf("junction entry digest = %q, want Node symlink digest %q", got, want)
  }
}
