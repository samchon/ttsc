package main

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFileDiscoversSupportedESLintFlatConfigExtensions verifies ESLint config discovery.
//
// Config discovery is directory-sensitive because projects may wrap tsconfig files or keep lint
// config in a nearer package folder. These tests use real temporary paths to validate that
// search order and conflict detection match the host contract.
//
// This scenario focuses on find lint config file discovers supported ESLint flat config
// extensions. It keeps path resolution behavior independent from rule parsing so discovery
// regressions are caught at the source.
//
// 1. Materialize the directory layout and candidate config files.
// 2. Run the discovery or explicit-path resolver helper.
// 3. Assert the selected path or the conflict diagnostic.
func TestFindLintConfigFileDiscoversSupportedESLintFlatConfigExtensions(t *testing.T) {
  for _, name := range []string{
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    "eslint.config.mts",
    "eslint.config.cts",
  } {
    t.Run(name, func(t *testing.T) {
      dir := t.TempDir()
      writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
      writeFile(t, filepath.Join(dir, name), "export default [];")

      discovered, err := findLintConfigFile(dir, "tsconfig.json")
      if err != nil {
        t.Fatalf("findLintConfigFile: %v", err)
      }
      if discovered != filepath.Join(dir, name) {
        t.Fatalf("unexpected discovery path: %s", discovered)
      }
    })
  }
}
