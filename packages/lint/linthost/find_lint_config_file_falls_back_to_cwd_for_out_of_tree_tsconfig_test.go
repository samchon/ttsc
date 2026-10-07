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
// dir. With no explicit launcher-origin channel and no lint config in the
// wrapper's ancestry, a tsconfig-dir-only walk would miss the project's config
// even though the project passed as cwd has one sitting right there.
//
//  1. Put a lint.config.json in the cwd directory and only a tsconfig.json in a
//     separate wrapper directory.
//  2. Call findLintConfigFile with cwd=dir and tsconfig=wrapperDir/tsconfig.json.
//  3. Assert the config next to cwd is discovered via the fallback origin.
//
// @evidence contracts/testing.md#behavioral-verification findLintConfigFile selects the cwd lint.config.json after the separate wrapper-tsconfig ancestry contains no candidate.
// @evidence contracts/testing.md#independent-expectations The original discovery contract permits a cwd fallback only after the tsconfig-origin walk fails; the two independently created directories establish the literal expected winner.
// @evidence contracts/testing.md#distinguishing-cases Owns absent-wrapper/present-cwd fallback; the outside-cwd priority test supplies the opposite case with both origins populated.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry clears the explicit launcher-origin channel with automatic restoration. Two temporary roots supply an absent wrapper config and present cwd config to findLintConfigFile in-process; selected path observes fallback without executing either project.
func TestFindLintConfigFileFallsBackToCwdForOutOfTreeTsconfig(t *testing.T) {
  t.Setenv(pluginConfigDirEnv, "")
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
