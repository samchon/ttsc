//go:build windows

package driver_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "golang.org/x/sys/windows"
)

// TestReportRejectedConfigCandidatesResolvesWindowsShortPath pins the concrete
// 8.3 spelling that exposed a permanently incomplete host-input manifest.
func TestReportRejectedConfigCandidatesResolvesWindowsShortPath(t *testing.T) {
  directory := filepath.Join(t.TempDir(), "directory candidate long name", "demo.config.json")
  if err := os.MkdirAll(directory, 0o755); err != nil {
    t.Fatal(err)
  }
  short := windowsShortPath(t, directory)
  physical, err := filepath.EvalSymlinks(short)
  if err != nil {
    t.Fatal(err)
  }

  var reported *string
  driver.ReportRejectedConfigCandidates(
    []driver.ConfigCandidate{{Directory: true, Path: short}},
    nil,
    func(_ string, realpath *string) { reported = realpath },
  )

  if reported == nil {
    t.Fatalf("expected long physical target %q for short spelling %q, got no proof", physical, short)
  }
  if *reported != filepath.Clean(physical) {
    t.Fatalf("expected long physical target %q for short spelling %q, got %q", physical, short, *reported)
  }
}

// windowsShortPath returns a distinct DOS alias, or skips on a volume where
// 8.3 name creation is disabled and the boundary cannot be manufactured.
func windowsShortPath(t *testing.T, value string) string {
  t.Helper()
  input, err := windows.UTF16PtrFromString(value)
  if err != nil {
    t.Fatal(err)
  }
  needed, err := windows.GetShortPathName(input, nil, 0)
  if err != nil || needed == 0 {
    t.Skipf("Windows short paths are unavailable: %v", err)
  }
  buffer := make([]uint16, needed)
  written, err := windows.GetShortPathName(input, &buffer[0], uint32(len(buffer)))
  if err != nil {
    t.Fatal(err)
  }
  short := windows.UTF16ToString(buffer[:written])
  if strings.EqualFold(filepath.Clean(short), filepath.Clean(value)) {
    t.Skip("the test volume did not assign a distinct 8.3 alias")
  }
  return short
}
