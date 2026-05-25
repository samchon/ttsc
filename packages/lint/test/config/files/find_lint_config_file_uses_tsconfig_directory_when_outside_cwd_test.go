package linthost

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFileUsesTsconfigDirectoryWhenOutsideCwd verifies that when the tsconfig
// path points outside cwd, discovery roots its walk at the tsconfig's directory, not cwd.
//
// Wrapper tsconfigs (e.g. a root tsconfig that references a package tsconfig via `extends`) are
// often stored in a separate temp directory. If discovery walked from cwd it would pick up the
// wrong config. The test uses two distinct temp dirs — one for cwd and one for the wrapper — to
// confirm that the tsconfig directory takes priority.
//
// 1. Place lint.config.json files in both the cwd directory and the wrapper tsconfig directory.
// 2. Call findLintConfigFile with cwd=dir and tsconfig=wrapperDir/tsconfig.json.
// 3. Assert the config co-located with the wrapper tsconfig is returned.
func TestFindLintConfigFileUsesTsconfigDirectoryWhenOutsideCwd(t *testing.T) {
  dir := t.TempDir()
  wrapperDir := t.TempDir()
  wrapper := filepath.Join(wrapperDir, "tsconfig.json")
  writeFile(t, wrapper, "{}")
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "rules": { "noConsole": "error" }
  }`)
  writeFile(t, filepath.Join(wrapperDir, "lint.config.json"), `{
    "rules": { "noVar": "error" }
  }`)

  discovered, err := findLintConfigFile(dir, wrapper)
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(wrapperDir, "lint.config.json") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
