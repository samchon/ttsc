package main

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestFindLintConfigFileRejectsSameDirectoryConflicts verifies conflict rejection.
//
// Config discovery is directory-sensitive because projects may wrap tsconfig files or keep lint
// config in a nearer package folder. These tests use real temporary paths to validate that
// search order and conflict detection match the host contract.
//
// This scenario focuses on find lint config file rejects same directory conflicts. It keeps
// path resolution behavior independent from rule parsing so discovery regressions are caught at
// the source.
//
// 1. Materialize the directory layout and candidate config files.
// 2. Run the discovery or explicit-path resolver helper.
// 3. Assert the selected path or the conflict diagnostic.
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
