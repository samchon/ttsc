package driver_test

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverDefaultWriteFileReportsParentPathError verifies disk writer errors
// are propagated when output parents cannot be created.
//
// This covers the practical failure branch in DefaultWriteFile without relying
// on platform-specific permission behavior.
//
// 1. Create a regular file where the output directory should be.
// 2. Ask DefaultWriteFile to write a child path under that file.
// 3. Assert the parent creation error is returned to the caller.
func TestDriverDefaultWriteFileReportsParentPathError(t *testing.T) {
  root := t.TempDir()
  blocked := filepath.Join(root, "blocked")
  if err := os.WriteFile(blocked, []byte("not a directory"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := driver.DefaultWriteFile(filepath.Join(blocked, "out.js"), "exports.value = 1;\n"); err == nil {
    t.Fatal("DefaultWriteFile should report a parent path error")
  }
}
