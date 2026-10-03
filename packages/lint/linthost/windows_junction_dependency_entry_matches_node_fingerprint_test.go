//go:build windows

package linthost

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestWindowsJunctionDependencyEntryMatchesNodeFingerprint verifies junction cache entries use the Node symlink fingerprint.
//
// Go and Node describe Windows reparse entries differently, so digest identity must retain the real junction target.
//
// 1. Create a directory junction and read its actual kernel target.
// 2. Independently hash the symlink wire prefix, NUL, and target.
// 3. Require the owning entry digest to equal that complete authored encoding.
//
// @evidence contracts/testing.md#behavioral-verification configDependencyDigest on a real windowsjunction-created directory entry equals the independently encoded symlink-target hash.
// @evidence contracts/testing.md#independent-expectations The loader wire contract hashes SHA256 over symlink followed by NUL and the os.Readlink target; the test constructs that digest independently of configDependencyDigest.
// @evidence contracts/testing.md#distinguishing-cases Owns a real directory junction whose directory-like Go mode must still take the link fingerprint route; ordinary file and directory digest behavior remains in config-cache units.
// @evidence contracts/testing.md#execution-ownership This Windows-constrained Go unit directly invokes the maintained package operation in the owning linthost process over disposable filesystem inputs. Windows supplies aliases and junction fixtures; no installed SDK, source overlay, product build or product host child is required. Fixture-only mklink preparation does not execute the behavior under test.
func TestWindowsJunctionDependencyEntryMatchesNodeFingerprint(t *testing.T) {
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
