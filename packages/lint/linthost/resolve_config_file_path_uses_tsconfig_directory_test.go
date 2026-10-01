package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigFilePathUsesTsconfigDirectory verifies that an explicit relative config path
// is resolved against the tsconfig's directory rather than cwd.
//
// When a plugin entry specifies `configFile: "./lint.config.json"`, the path is relative to the
// tsconfig file that the plugin entry belongs to. Resolving it against cwd instead would fail
// for any workspace package whose tsconfig sits in a subdirectory different from cwd.
//
// 1. Create two distinct temp dirs: one for cwd and one for the wrapper tsconfig.
// 2. Call resolveConfigFilePath with a relative path and the wrapper tsconfig location.
// 3. Assert the result is joined with the tsconfig directory, not cwd.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigFilePath anchors ./lint.config.json at the separate tsconfig directory instead of the unrelated cwd.
// @evidence contracts/testing.md#independent-expectations Relative explicit config paths belong to their declaring tsconfig; filepath.Join on that authored origin supplies a literal path oracle without calling the resolver.
// @evidence contracts/testing.md#distinguishing-cases Owns relative config with distinct cwd and tsconfig roots; env-owned config-directory precedence is checked separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The temporary wrapper and unrelated cwd reach resolveConfigFilePath directly in the shared Go process; the returned explicit path is inspected without loading config contents or spawning a host.
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
