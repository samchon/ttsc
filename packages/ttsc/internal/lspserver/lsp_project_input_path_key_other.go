//go:build !windows

package lspserver

import "path/filepath"

func projectInputPathKey(location string) string {
  return filepath.ToSlash(filepath.Clean(filepath.FromSlash(location)))
}
