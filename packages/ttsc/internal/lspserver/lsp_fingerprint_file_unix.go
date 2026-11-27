//go:build unix

package lspserver

import (
  "os"

  "golang.org/x/sys/unix"
)

// openProjectInputFingerprintFile opens without waiting for a pipe peer if a
// regular path was replaced before the open. The caller checks the descriptor.
func openProjectInputFingerprintFile(location string) (*os.File, error) {
  return os.OpenFile(location, os.O_RDONLY|unix.O_NONBLOCK, 0)
}
