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
// @evidence contracts/testing.md#behavioral-verification Calls DefaultWriteFile for an absent nested output directory and independently reads back exact emitted bytes.
// @evidence contracts/testing.md#independent-expectations The literal exports.value = 1 source is supplied before the writer executes, then compared with an OS file read.
// @evidence contracts/testing.md#distinguishing-cases Absent parent directories exercise materialization; the sibling blocked-parent case owns the error boundary.
// @evidence contracts/testing.md#execution-ownership The owning Go unit uses its disposable t.TempDir and the direct writer API without a compiler, installed consumer or CLI child.
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
