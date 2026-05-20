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
func TestFindLintConfigFileDiscoversPlainLintConfig(t *testing.T) {
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
