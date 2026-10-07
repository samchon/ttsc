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
// validator hashes one dangling exact-file symlink using raw target bytes.
//
// Decoding a POSIX link target as UTF-8 replaces invalid bytes, making an
// unchanged launcher snapshot disagree with the native validator. The unit
// compares Go output with independently authored protocol records; it does not
// execute the launcher. A creation error skips without identifying its cause,
// and successful creation must retain the raw bytes to exercise this vector.
//
//  1. Create a dangling symlink with a non-UTF-8 raw target where supported.
//  2. Read it back and continue only when the filesystem preserved the bytes.
//  3. Hash the protocol's symlink, raw target, and missing-content records.
//  4. Assert the production fingerprint is exactly that digest.
//
// @evidence contracts/testing.md#behavioral-verification The production fingerprint of a dangling symlink with a non-UTF-8 raw target equals the digest of the protocol's symlink, raw target and missing-content records.
// @evidence contracts/testing.md#independent-expectations The expected digest is computed independently from the protocol bytes in the test.
// @evidence contracts/testing.md#distinguishing-cases The target starts with invalid UTF-8 byte 0xff followed by x, and the dangling link contributes the missing-content marker. Successful native read-back must equal those bytes; creation failure or changed read-back skips this vector, without proving a particular capability failure. Valid UTF-8 links, readable linked files and read-error recovery are not covered.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit creates and reads one actual symlink in an owned temporary root, calls actual projectInputReloadFileDigest, and constructs expected SHA-256 input independently with literal framing and target bytes. No substituted operation, native child, sidecar, installed consumer, product host or launcher executes.
func TestReloadFileFingerprintPreservesRawSymlinkTarget(t *testing.T) {
  target := string([]byte{0xff, 'x'})
  link := filepath.Join(t.TempDir(), "reload-link")
  if err := os.Symlink(target, link); err != nil {
    t.Skipf("raw-byte symlink fixture creation failed: %v", err)
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
