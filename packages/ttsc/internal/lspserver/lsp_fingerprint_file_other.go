//go:build !unix

package lspserver

import "os"

func openProjectInputFingerprintFile(location string) (*os.File, error) {
  return os.Open(location)
}
