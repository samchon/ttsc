//go:build !windows

package linthost

import "testing"

func windowsShortPathForTest(t *testing.T, _ string) string {
  t.Helper()
  t.Skip("Windows 8.3 paths are platform-specific")
  return ""
}
