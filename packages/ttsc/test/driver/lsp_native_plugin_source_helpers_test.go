package driver_test

import (
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "testing"
)

func buildNativePluginSourceTestSidecar(t *testing.T, dir string, sourceText string) string {
  t.Helper()
  source := filepath.Join(dir, "fake_sidecar.go")
  if err := os.WriteFile(source, []byte(sourceText), 0644); err != nil {
    t.Fatal(err)
  }
  binary := filepath.Join(dir, "fake-sidecar")
  if runtime.GOOS == "windows" {
    binary += ".exe"
  }
  cmd := exec.Command("go", "build", "-o", binary, source)
  if out, err := cmd.CombinedOutput(); err != nil {
    t.Fatalf("go build fake sidecar failed: %v\n%s", err, out)
  }
  return binary
}
