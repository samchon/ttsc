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
// @evidence contracts/testing.md#execution-ownership TestWindowsJunctionDependencyEntryMatchesNodeFingerprint is a Windows-only Go boundary entry in the setup batch; its source-private operation is executed through the shared Go overlay rather than repeated consumer installs or product builds.
// @evidence contracts/e2e.md#necessary-boundary windowsjunction.Create and os.Readlink exercise a Windows reparse point that Linux fixture directories cannot represent.
// @evidence contracts/e2e.md#shared-execution Reuses the setup Windows Go process and source overlay shared by the other kernel cases; only its small filesystem fixture is distinct, with no separate native producer or consumer install.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns the fixture and its link or alias inputs; no shared mutable project or cache entry is reused across cases, and test cleanup releases its directories.
// @evidence contracts/e2e.md#preserved-coverage Transfers the original real-junction creation, readable target and exact independent hash equality; Windows-only selection replaces the former non-Windows whole-test skip.
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
