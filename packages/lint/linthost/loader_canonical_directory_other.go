//go:build !windows

package linthost

import (
  "os"
  "path/filepath"
)

// loaderCanonicalDirectory resolves the existing directory on non-Windows hosts.
func loaderCanonicalDirectory(path string) (string, error) {
  return filepath.EvalSymlinks(path)
}

// loaderContainsDirectory compares opened filesystem identities so case-only
// aliases on a case-insensitive POSIX volume cannot hide ancestry.
func loaderContainsDirectory(base, child string) (bool, error) {
  baseInfo, err := os.Stat(base)
  if err != nil {
    return false, err
  }
  for current := filepath.Clean(child); ; current = filepath.Dir(current) {
    info, err := os.Stat(current)
    if err != nil {
      return false, err
    }
    if os.SameFile(baseInfo, info) {
      return true, nil
    }
    if parent := filepath.Dir(current); parent == current {
      return false, nil
    }
  }
}
