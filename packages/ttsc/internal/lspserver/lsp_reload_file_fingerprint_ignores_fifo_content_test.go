//go:build linux || darwin

package lspserver

import (
  "crypto/sha256"
  "fmt"
  "os"
  "path/filepath"
  "testing"
  "time"

  "golang.org/x/sys/unix"
)

// TestLSPReloadFileFingerprintIgnoresFIFOContent verifies that selection
// fingerprints do not need a writer for a named pipe reached through a link.
//
//  1. Create a real pipe and a link to it without opening a writer.
//  2. Fingerprint the link and require the link-target and missing-content frame.
//
// @evidence contracts/testing.md#behavioral-verification The production fingerprint returns without a FIFO peer and retains the observed link target.
// @evidence contracts/testing.md#independent-expectations A literal frame includes the authored absolute target and missing marker, hashed independently of the production helper.
// @evidence contracts/testing.md#distinguishing-cases A symlink to a FIFO is distinct from a missing entry or a symlink reaching readable regular bytes. The deadline catches a blocked read.
// @evidence contracts/testing.md#execution-ownership The Go unit owns its named pipe and symlink. A rescue descriptor is only used to release a blocked fingerprint when reporting a regression.
func TestLSPReloadFileFingerprintIgnoresFIFOContent(t *testing.T) {
  root := t.TempDir()
  pipe := filepath.Join(root, "input.pipe")
  link := filepath.Join(root, "input-link")
  if err := unix.Mkfifo(pipe, 0o600); err != nil {
    t.Fatal(err)
  }
  if err := os.Symlink(pipe, link); err != nil {
    t.Fatal(err)
  }
  expected := fmt.Sprintf("%x", sha256.Sum256([]byte("symlink\x00"+pipe+"\x00missing\x00")))
  result := make(chan string, 1)
  go func() { result <- projectInputReloadFileDigest(link) }()
  select {
  case got := <-result:
    if got != expected {
      t.Fatalf("fingerprint = %q, want %q", got, expected)
    }
  case <-time.After(2 * time.Second):
    if fd, err := unix.Open(pipe, unix.O_RDWR|unix.O_NONBLOCK, 0); err == nil {
      unix.Close(fd)
    }
    t.Fatal("fingerprinting the link waited for a FIFO writer")
  }
}
