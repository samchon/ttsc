package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestFindLintConfigFileRejectsSameDirectoryConflicts verifies that multiple recognized config
// files in the same directory produce an error instead of silently picking one.
//
// Choosing arbitrarily between eslint.config.mjs and ttsc-lint.config.cjs in the same directory
// would apply a config the user didn't intend. The explicit conflict error forces the user to
// remove the ambiguity rather than relying on undocumented selection order.
//
// 1. Write both eslint.config.mjs and ttsc-lint.config.cjs in the same temp directory.
// 2. Call findLintConfigFile.
// 3. Assert the error contains "multiple lint config files found".
func TestFindLintConfigFileRejectsSameDirectoryConflicts(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "eslint.config.mjs"), "export default [];")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), "module.exports = {};")

  _, err := findLintConfigFile(dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected conflicting lint config files to fail")
  }
  if !strings.Contains(err.Error(), "multiple lint config files found") {
    t.Fatalf("error should explain conflict, got %v", err)
  }
}
