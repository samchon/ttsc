//go:build !windows

package main

import "path/filepath"

// diskRealpath resolves physical identity using the native filesystem. An empty
// result records unavailable identity rather than substituting the lexical path.
func diskRealpath(path string) string {
  resolved, err := filepath.EvalSymlinks(path)
  if err != nil {
    return ""
  }
  if absolute, err := filepath.Abs(resolved); err == nil {
    resolved = absolute
  }
  return filepath.Clean(resolved)
}
