package lspserver

import (
  "bytes"
  "crypto/sha256"
  "fmt"
  "os"
  "path/filepath"
  "testing"
)

// TestReloadFileFingerprintPreservesRawSymlinkTarget verifies the Go startup
// validator hashes exact-file symlinks with the launcher's byte protocol.
//
// Decoding a POSIX link target as UTF-8 replaces invalid bytes, making an
// unchanged launcher snapshot disagree with the native validator forever. The
// capability check keeps the vector portable to filesystems that cannot retain
// the raw name while requiring byte fidelity wherever they can.
//
//  1. Create a dangling symlink with a non-UTF-8 raw target where supported.
//  2. Read it back and continue only when the filesystem preserved the bytes.
//  3. Hash the protocol's symlink, raw target, and missing-content records.
//  4. Assert the production fingerprint is exactly that digest.
//
// @evidence contracts/testing.md#behavioral-verification The production fingerprint of a dangling symlink with a non-UTF-8 raw target equals the digest of the protocol's symlink, raw target and missing-content records.
// @evidence contracts/testing.md#independent-expectations The expected digest is computed independently from the protocol bytes in the test.
// @evidence contracts/testing.md#distinguishing-cases The test continues only when the filesystem preserved the raw bytes, so unsupported filesystems skip and supported ones require fidelity.
// @evidence contracts/testing.md#execution-ownership TestReloadFileFingerprintPreservesRawSymlinkTarget is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestReloadFileFingerprintPreservesRawSymlinkTarget(t *testing.T) {
  target := string([]byte{0xff, 'x'})
  link := filepath.Join(t.TempDir(), "reload-link")
  if err := os.Symlink(target, link); err != nil {
    t.Skipf("filesystem cannot create the raw-byte symlink: %v", err)
  }
  retained, err := os.Readlink(link)
  if err != nil {
    t.Fatal(err)
  }
  if !bytes.Equal([]byte(retained), []byte(target)) {
    t.Skip("filesystem did not retain the raw non-UTF-8 link target")
  }

  digest := sha256.New()
  digest.Write([]byte("symlink\x00"))
  digest.Write([]byte(target))
  digest.Write([]byte{0})
  digest.Write([]byte("missing\x00"))
  expected := fmt.Sprintf("%x", digest.Sum(nil))
  if got := projectInputReloadFileDigest(link); got != expected {
    t.Fatalf("reload symlink digest = %s, want raw-byte protocol %s", got, expected)
  }
}
