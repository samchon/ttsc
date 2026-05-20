package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigFilePathUsesTsconfigDirectory verifies that an explicit relative config path
// is resolved against the tsconfig's directory rather than cwd.
//
// When a plugin entry specifies `config: "./lint.config.json"`, the path is relative to the
// tsconfig file that the plugin entry belongs to. Resolving it against cwd instead would fail
// for any workspace package whose tsconfig sits in a subdirectory different from cwd.
//
// 1. Create two distinct temp dirs: one for cwd and one for the wrapper tsconfig.
// 2. Call resolveConfigFilePath with a relative path and the wrapper tsconfig location.
// 3. Assert the result is joined with the tsconfig directory, not cwd.
func TestResolveConfigFilePathUsesTsconfigDirectory(t *testing.T) {
  dir := t.TempDir()
  wrapper := filepath.Join(t.TempDir(), "tsconfig.json")
  writeFile(t, wrapper, "{}")

  resolved := resolveConfigFilePath("./lint.config.json", dir, wrapper)
  expected := filepath.Join(filepath.Dir(wrapper), "lint.config.json")
  if resolved != expected {
    t.Fatalf("unexpected explicit config path: got %s, want %s", resolved, expected)
  }
}
