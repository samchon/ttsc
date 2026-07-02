package paths_test

import (
  "testing"
  "time"
)

// TestRewriterCommonSourceDirTerminatesAtVolumeRoots verifies rootDir inference never spins at a root.
//
// Locks the termination contract of `paths.go::commonSourceDir` (#310). The
// previous byte-oriented walk compared `filepath.Dir`'s native result against
// a slash-normalized cursor, so once the shared prefix shrank to a Windows
// volume root ("C:\" vs "C:/") the loop re-normalized the same directory
// forever — a `files` list spanning two volumes hung the sidecar until the
// 10-minute test timeout. The component intersection must instead mirror
// TypeScript-Go's computeCommonSourceDirectoryOfFilenames: stop at the volume
// root, and report "no common root" for cross-volume inputs.
//
// 1. Intersect files that share only a volume root, and files on two volumes.
// 2. Assert the volume root (with separator) and "" respectively.
// 3. Assert POSIX roots and case-only differences keep the same contract.
func TestRewriterCommonSourceDirTerminatesAtVolumeRoots(t *testing.T) {
  cases := []struct {
    name     string
    files    []string
    expected string
  }{
    {"windows volume root", []string{"C:/alpha/main.ts", "C:/beta/util.ts"}, "C:/"},
    {"windows cross volume", []string{"C:/alpha/main.ts", "D:/beta/util.ts"}, ""},
    {"windows drive letter case", []string{"c:/alpha/main.ts", "C:/alpha/util.ts"}, "c:/alpha"},
    {"posix root", []string{"/alpha/main.ts", "/beta/util.ts"}, "/"},
    {"posix nested", []string{"/repo/src/main.ts", "/repo/src/lib/util.ts"}, "/repo/src"},
    {"single file", []string{"/repo/src/main.ts"}, "/repo/src"},
    {"empty", nil, ""},
  }
  for _, c := range cases {
    done := make(chan string, 1)
    go func() { done <- pathsCommonSourceDir(c.files, "/", false) }()
    select {
    case got := <-done:
      if got != c.expected {
        t.Fatalf("%s: commonSourceDir mismatch: got %q, expected %q", c.name, got, c.expected)
      }
    case <-time.After(30 * time.Second):
      t.Fatalf("%s: commonSourceDir did not terminate", c.name)
    }
  }
}
