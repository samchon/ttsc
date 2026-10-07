package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigLoadsJSONConfigFile verifies that a `configFile` pointing to a .json file
// is loaded natively and its severities are parsed correctly.
//
// JSON config loading is the zero-subprocess path: no Node child process is spawned.
// LoadRuleConfig must route .json extensions through the native JSON
// loader and correctly handle string severity aliases like "warning" (which maps to SeverityWarn).
//
// 1. Write tsconfig.json and a ttsc-lint.config.json with two rules under `rules`.
// 2. Call LoadRuleConfig with `configFile: "./ttsc-lint.config.json"`.
// 3. Assert both rules resolve to the expected severities including the "warning" alias.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig loads the explicit JSON config and resolves no-var/error, eqeqeq/warning and the executable-loader donor vocabulary no-console/warning plus no-debugger/error to their distinct native severities.
// @evidence contracts/testing.md#independent-expectations The supported severity vocabulary maps error to SeverityError and warning to SeverityWarn; literal authored rule values establish the independent normalization oracle.
// @evidence contracts/testing.md#distinguishing-cases Owns native JSON dispatch and the warning alias alongside error for both original rules and the CJS loader donor's exact no-console/no-debugger names; malformed JSON and executable JS/TS loaders are separate entries.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The temporary explicit JSON file reaches LoadRuleConfig directly in the shared Go process; four resulting severities observe native JSON loading without executable config evaluation.
func TestLoadRuleConfigLoadsJSONConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.json"), `{
    "rules": {
      "no-var": "error",
      "eqeqeq": "warning",
      "no-console": "warning",
      "no-debugger": "error"
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
  if cfg.Severity("no-console") != SeverityWarn {
    t.Errorf("noConsole: want warning, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-debugger") != SeverityError {
    t.Errorf("noDebugger: want error, got %v", cfg.Severity("no-debugger"))
  }
  if cfg.Severity("eqeqeq") != SeverityWarn {
    t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
  }
}
