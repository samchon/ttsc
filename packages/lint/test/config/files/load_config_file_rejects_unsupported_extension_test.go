package main

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadConfigFileRejectsUnsupportedExtension verifies config extension validation.
//
// Discovery only returns supported lint and ESLint config filenames, but
// explicit plugin config paths can point anywhere. The generic loader must
// reject unknown extensions before trying JSON or Node-backed loaders.
//
// This scenario keeps extension handling isolated from filesystem read errors
// by creating a real file with an unsupported suffix.
//
// 1. Write a config-like file with an unsupported extension.
// 2. Load it through the generic config loader.
// 3. Assert the unsupported-extension diagnostic is returned.
func TestLoadConfigFileRejectsUnsupportedExtension(t *testing.T) {
  dir := t.TempDir()
  location := filepath.Join(dir, "lint.config.yaml")
  writeFile(t, location, "rules: {}\n")

  _, err := loadConfigFile(location)
  if err == nil {
    t.Fatal("expected unsupported config extension to fail")
  }
  if !strings.Contains(err.Error(), "unsupported config file extension") {
    t.Fatalf("error should mention unsupported extension, got %v", err)
  }
}
