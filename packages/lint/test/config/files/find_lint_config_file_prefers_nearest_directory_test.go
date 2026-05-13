package main

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFilePrefersNearestDirectory verifies nearest directory preference.
//
// Config discovery is directory-sensitive because projects may wrap tsconfig files or keep lint
// config in a nearer package folder. These tests use real temporary paths to validate that
// search order and conflict detection match the host contract.
//
// This scenario focuses on find lint config file prefers nearest directory. It keeps path
// resolution behavior independent from rule parsing so discovery regressions are caught at the
// source.
//
// 1. Materialize the directory layout and candidate config files.
// 2. Run the discovery or explicit-path resolver helper.
// 3. Assert the selected path or the conflict diagnostic.
func TestFindLintConfigFilePrefersNearestDirectory(t *testing.T) {
  dir := t.TempDir()
  nested := filepath.Join(dir, "packages", "app")
  writeFile(t, filepath.Join(dir, "eslint.config.mjs"), "export default [];")
  writeFile(t, filepath.Join(nested, "ttsc-lint.config.cjs"), "module.exports = {};")
  writeFile(t, filepath.Join(nested, "tsconfig.json"), "{}")

  discovered, err := findLintConfigFile(dir, filepath.Join("packages", "app", "tsconfig.json"))
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(nested, "ttsc-lint.config.cjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
