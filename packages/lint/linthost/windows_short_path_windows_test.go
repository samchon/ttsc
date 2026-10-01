//go:build windows

package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  "golang.org/x/sys/windows"
)

// windowsShortPathForTest returns the 8.3 spelling of an existing path. Some
// volumes disable short-name creation, so callers skip when Windows cannot
// provide an alias that differs from the long spelling.
func windowsShortPathForTest(t *testing.T, path string) string {
  t.Helper()
  longPath, err := windows.UTF16PtrFromString(path)
  if err != nil {
    t.Fatalf("encode Windows path: %v", err)
  }
  size, err := windows.GetShortPathName(longPath, nil, 0)
  if err != nil {
    t.Fatalf("measure Windows short path: %v", err)
  }
  buffer := make([]uint16, size)
  length, err := windows.GetShortPathName(longPath, &buffer[0], uint32(len(buffer)))
  if err != nil {
    t.Fatalf("resolve Windows short path: %v", err)
  }
  if length >= uint32(len(buffer)) {
    t.Fatalf("Windows short path changed size while resolving: need %d, have %d", length, len(buffer))
  }
  short := filepath.Clean(windows.UTF16ToString(buffer[:length]))
  if short == "." || strings.EqualFold(short, filepath.Clean(path)) {
    t.Skip("the test volume does not expose an 8.3 alias for this path")
  }
  return short
}
