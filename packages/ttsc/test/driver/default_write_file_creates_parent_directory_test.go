package driver_test

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverDefaultWriteFileCreatesParentDirectory verifies the default emit
// writer can materialize nested output paths.
//
// This covers the normal disk writer path used when callers do not provide a
// custom TypeScript-Go WriteFile callback.
//
// 1. Pick a nested output file path in a temporary directory.
// 2. Write through the public DefaultWriteFile helper.
// 3. Assert parent directories and file contents were created.
func TestDriverDefaultWriteFileCreatesParentDirectory(t *testing.T) {
  root := t.TempDir()

  // Write assertion: command-side emit callers rely on this helper when no
  // custom WriteFile callback is supplied.
  file := filepath.Join(root, "deep", "out", "index.js")
  if err := driver.DefaultWriteFile(file, "exports.value = 1;\n"); err != nil {
    t.Fatal(err)
  }
  data, err := os.ReadFile(file)
  if err != nil {
    t.Fatal(err)
  }
  if string(data) != "exports.value = 1;\n" {
    t.Fatalf("unexpected file contents: %q", data)
  }
}
