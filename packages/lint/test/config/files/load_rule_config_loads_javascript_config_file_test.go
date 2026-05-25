package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigLoadsJavaScriptConfigFile verifies that a `configFile` pointing to a .cjs
// file is loaded via the Node subprocess config loader.
//
// JavaScript config files (CJS or ESM) cannot be parsed natively; they require a Node child
// process. LoadRuleConfig must route .js/.cjs/.mjs extensions through the Node loader rather
// than the JSON parser. A regression that sent a .cjs path to the JSON parser would fail with a
// syntax error instead of evaluating the module.
//
// 1. Write tsconfig.json and a .cjs config file exporting an ITtscLintConfig object.
// 2. Call LoadRuleConfig with `configFile: "./ttsc-lint.config.cjs"`.
// 3. Assert both rules from the CJS module are resolved correctly.
func TestLoadRuleConfigLoadsJavaScriptConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), `module.exports = {
    rules: {
      "noConsole": "warning",
      "noDebugger": "error",
    },
  };`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.cjs",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("noConsole") != SeverityWarn {
    t.Errorf("noConsole: want warning, got %v", cfg.Severity("noConsole"))
  }
  if cfg.Severity("noDebugger") != SeverityError {
    t.Errorf("noDebugger: want error, got %v", cfg.Severity("noDebugger"))
  }
}
