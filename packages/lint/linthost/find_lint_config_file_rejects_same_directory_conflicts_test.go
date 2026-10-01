package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestFindLintConfigFileRejectsSameDirectoryConflicts verifies that multiple recognized config
// files in the same directory produce an error instead of silently picking one.
//
// Choosing arbitrarily between lint.config.mjs and ttsc-lint.config.cjs in the same directory
// would apply a config the user didn't intend. The explicit conflict error forces the user to
// remove the ambiguity (or set "configFile") rather than relying on undocumented selection order.
//
// 1. Write both lint.config.mjs and ttsc-lint.config.cjs in the same temp directory.
// 2. Call findLintConfigFile.
// 3. Assert the error contains "multiple lint config files found".
//
// @evidence contracts/testing.md#behavioral-verification findLintConfigFile returns a non-nil multiple-config error when lint.config.mjs and ttsc-lint.config.cjs coexist beside one tsconfig.
// @evidence contracts/testing.md#independent-expectations Automatic discovery must not choose arbitrarily between equally local supported config names; the literal multiple-config diagnostic and fixture pair establish that independent requirement.
// @evidence contracts/testing.md#distinguishing-cases Owns equal-depth conflicting candidates; single-candidate acceptance and different-depth nearest selection have separate tests.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Two temporary equally local script-config filenames reach findLintConfigFile directly in-process; conflict error is observed before any config script is evaluated.
func TestFindLintConfigFileRejectsSameDirectoryConflicts(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "lint.config.mjs"), "export default {};")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), "module.exports = {};")

  _, err := findLintConfigFile(dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected conflicting lint config files to fail")
  }
  if !strings.Contains(err.Error(), "multiple lint config files found") {
    t.Fatalf("error should explain conflict, got %v", err)
  }
}
