package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestRealProjectPathExpandsWindowsShortAncestorForMissingDescendant pins the
// path shape that broke global ignores on Windows CI: the project directory
// exists through an 8.3 alias, but the synthetic source path does not exist and
// therefore cannot be passed directly to filepath.EvalSymlinks.
func TestRealProjectPathExpandsWindowsShortAncestorForMissingDescendant(t *testing.T) {
  longRoot := realProjectPath(t.TempDir())
  shortRoot := windowsShortPathForTest(t, longRoot)
  shortFile := filepath.Join(shortRoot, "generated", "types", "validator.ts")
  longFile := filepath.Join(longRoot, "generated", "types", "validator.ts")

  if got := realProjectPath(shortFile); !strings.EqualFold(got, longFile) {
    t.Fatalf("missing descendant did not inherit long-path identity: got %q, want %q", got, longFile)
  }
  if !matchAnyPattern(shortRoot, []string{"generated/**"}, shortFile) {
    t.Fatal("global ignore did not match a missing descendant below an 8.3 project root")
  }

  outsideRoot := realProjectPath(t.TempDir())
  outside := filepath.Join(outsideRoot, "generated", "types", "validator.ts")
  if matchAnyPattern(shortRoot, []string{"generated/**"}, outside) {
    t.Fatal("global ignore matched a path outside the aliased project root")
  }
}
