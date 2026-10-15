//go:build !windows

package configloaderscratch

import (
  "os"
  "path/filepath"
)

// canonicalDirectory resolves the existing directory on non-Windows hosts.
func canonicalDirectory(path string) (string, error) {
  return filepath.EvalSymlinks(path)
}

// containsDirectory compares opened filesystem identities so case-only aliases
// on a case-insensitive POSIX volume cannot hide an ancestor relationship.
func containsDirectory(base, child string) (bool, error) {
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
