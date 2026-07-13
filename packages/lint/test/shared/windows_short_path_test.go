package linthost

import (
  "fmt"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// windowsShortPathForTest returns the 8.3 spelling of an existing path. Some
// volumes disable short-name creation, so callers skip when Windows cannot
// provide an alias that differs from the long spelling.
func windowsShortPathForTest(t *testing.T, path string) string {
  t.Helper()
  if runtime.GOOS != "windows" {
    t.Skip("Windows 8.3 paths are platform-specific")
  }
  command := fmt.Sprintf(`for %%I in ("%s") do @echo %%~sI`, strings.ReplaceAll(path, `"`, `""`))
  output, err := exec.Command("cmd.exe", "/d", "/s", "/c", command).CombinedOutput()
  if err != nil {
    t.Fatalf("resolve Windows short path: %v: %s", err, output)
  }
  short := filepath.Clean(strings.TrimSpace(string(output)))
  if short == "." || strings.EqualFold(short, filepath.Clean(path)) {
    t.Skip("the test volume does not expose an 8.3 alias for this path")
  }
  return short
}
