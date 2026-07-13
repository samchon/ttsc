package linthost

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFileFallsBackToCwdForOutOfTreeTsconfig verifies that when
// the tsconfig directory's upward walk finds no lint config, discovery retries
// from cwd before giving up.
//
// Build integrations hand ttsc a wrapper tsconfig written into the system temp
// dir (a rollup config that `extends` the real project tsconfig, then calls
// TtscCompiler with cwd/projectRoot pointing at the project). The temp dir's
// ancestry holds no lint config, so a tsconfig-dir-only walk failed the build
// with "no lint.config.* found" even though the project passed as cwd has one
// sitting right there.
//
//  1. Put a lint.config.json in the cwd directory and only a tsconfig.json in a
//     separate wrapper directory.
//  2. Call findLintConfigFile with cwd=dir and tsconfig=wrapperDir/tsconfig.json.
//  3. Assert the config next to cwd is discovered via the fallback origin.
func TestFindLintConfigFileFallsBackToCwdForOutOfTreeTsconfig(t *testing.T) {
  dir := t.TempDir()
  wrapperDir := t.TempDir()
  wrapper := filepath.Join(wrapperDir, "tsconfig.json")
  writeFile(t, wrapper, "{}")
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "rules": { "no-console": "error" }
  }`)

  discovered, err := findLintConfigFile(dir, wrapper)
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(dir, "lint.config.json") {
    t.Fatalf("want cwd fallback discovery of %s, got %q", filepath.Join(dir, "lint.config.json"), discovered)
  }
}
