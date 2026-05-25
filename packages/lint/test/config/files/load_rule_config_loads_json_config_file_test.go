package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigLoadsJSONConfigFile verifies that a `configFile` pointing to a .json file
// is loaded natively and its severities are parsed correctly.
//
// JSON config loading is the zero-subprocess path: no Node child process is spawned, making it
// the fastest option for CI. LoadRuleConfig must route .json extensions through the native JSON
// loader and correctly handle string severity aliases like "warning" (which maps to SeverityWarn).
//
// 1. Write tsconfig.json and a ttsc-lint.config.json with two rules under `rules`.
// 2. Call LoadRuleConfig with `configFile: "./ttsc-lint.config.json"`.
// 3. Assert both rules resolve to the expected severities including the "warning" alias.
func TestLoadRuleConfigLoadsJSONConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.json"), `{
    "rules": {
      "no-var": "error",
      "eqeqeq": "warning"
    }
  }`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.json",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("noVar: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("eqeqeq") != SeverityWarn {
    t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
  }
}
