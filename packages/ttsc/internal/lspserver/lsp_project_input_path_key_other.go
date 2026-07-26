//go:build !windows

package lspserver

import "path/filepath"

func physicalProjectInputPath(location string) (string, error) {
  return filepath.EvalSymlinks(location)
}

func projectInputPathKey(location string) string {
  return filepath.ToSlash(filepath.Clean(filepath.FromSlash(location)))
}
