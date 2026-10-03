package linthost

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFileDiscoversPlainLintConfig verifies that the native lint.config.* family
// is recognized when co-located with tsconfig.json.
//
// Projects that don't use ESLint may configure ttsc/lint via a plain lint.config.json or .ts
// file. Discovery must recognize these names as candidates without requiring any eslint.config.*
// prefix. A regression that only matched eslint.* names would leave native-only configs silently
// unconfigured.
//
// 1. Write tsconfig.json and lint.config.ts in the same directory.
// 2. Call findLintConfigFile.
// 3. Assert lint.config.ts is the discovered path.
//
// @evidence contracts/testing.md#behavioral-verification findLintConfigFile recognizes a co-located lint.config.ts rather than requiring an ESLint or ttsc-prefixed filename.
// @evidence contracts/testing.md#independent-expectations The supported lint.config.* naming contract and exact fixture path establish the selected result without evaluating the config script.
// @evidence contracts/testing.md#distinguishing-cases Owns the native unprefixed candidate next to tsconfig; conflict and nearest-parent distinctions have separate entries.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry clears the explicit launcher-origin channel with automatic restoration. The temporary co-located tsconfig and lint.config.ts reach findLintConfigFile directly in-process; only the discovered path is observed and the script is not evaluated or compiled.
func TestFindLintConfigFileDiscoversPlainLintConfig(t *testing.T) {
  t.Setenv(pluginConfigDirEnv, "")
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "lint.config.ts"), "export default {};")

  discovered, err := findLintConfigFile(dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(dir, "lint.config.ts") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
