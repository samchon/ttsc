package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadConfigFileRejectsUnsupportedExtension verifies config extension validation.
//
// Discovery only returns supported lint.config.* / ttsc-lint.config.* filenames,
// but an explicit `configFile` path can point anywhere. The generic loader must
// reject unknown extensions before trying JSON or Node-backed loaders.
//
// This scenario keeps extension handling isolated from filesystem read errors
// by creating a real file with an unsupported suffix.
//
// 1. Write a config-like file with an unsupported extension.
// 2. Load it through the generic config loader.
// 3. Assert the unsupported-extension diagnostic is returned.
//
// @evidence contracts/testing.md#behavioral-verification loadConfigFile rejects a real config-like YAML file before dispatching a JSON or script evaluator, avoiding a misleading read or execution error.
// @evidence contracts/testing.md#independent-expectations The supported config suffix contract excludes .yaml; the exact existing fixture and literal unsupported-extension diagnostic establish rejection independently of dispatch code.
// @evidence contracts/testing.md#distinguishing-cases Owns an existing but unsupported file, separating extension validation from missing-file errors; JSON and executable supported loaders have other entries.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. A real temporary YAML file reaches loadConfigFile directly in the shared Go process; unsupported-extension error precedes JSON/script dispatch, so no evaluator child or native artifact is needed.
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
