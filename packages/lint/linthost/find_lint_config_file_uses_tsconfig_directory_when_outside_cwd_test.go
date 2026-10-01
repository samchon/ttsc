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
//
// @evidence contracts/testing.md#behavioral-verification findLintConfigFile chooses the wrapper tsconfig directory config even when a distinct cwd also contains a recognized config.
// @evidence contracts/testing.md#independent-expectations Discovery begins at the tsconfig origin and uses cwd only as fallback; distinct fixture roots and the literal wrapper path establish the independently expected selection.
// @evidence contracts/testing.md#distinguishing-cases Owns competing out-of-tree and cwd candidates; the fallback test covers the adjacent missing-wrapper case.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Separate temporary cwd and wrapper roots each contain a config before findLintConfigFile runs in-process; exact wrapper winner observes origin precedence without loading script contents.
func TestFindLintConfigFileUsesTsconfigDirectoryWhenOutsideCwd(t *testing.T) {
  dir := t.TempDir()
  wrapperDir := t.TempDir()
  wrapper := filepath.Join(wrapperDir, "tsconfig.json")
  writeFile(t, wrapper, "{}")
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "rules": { "no-console": "error" }
  }`)
  writeFile(t, filepath.Join(wrapperDir, "lint.config.json"), `{
    "rules": { "no-var": "error" }
  }`)

  discovered, err := findLintConfigFile(dir, wrapper)
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(wrapperDir, "lint.config.json") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
