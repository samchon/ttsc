package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigLoadsJavaScriptConfigFile verifies that an explicit `config` path pointing
// to a .cjs file is loaded via the Node subprocess config loader.
//
// JavaScript config files (CJS or ESM) cannot be parsed natively; they require a Node child
// process. LoadRuleConfig must route .js/.cjs/.mjs extensions through the Node loader rather
// than the JSON parser. A regression that sent a .cjs path to the JSON parser would fail with a
// syntax error instead of evaluating the module.
//
// 1. Write tsconfig.json and a .cjs config file exporting a rules object.
// 2. Call LoadRuleConfig with `config: "./ttsc-lint.config.cjs"`.
// 3. Assert both rules from the CJS module are resolved correctly.
func TestLoadRuleConfigLoadsJavaScriptConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), `module.exports = {
    "no-console": "warn",
    "no-debugger": "error",
  };`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "config": "./ttsc-lint.config.cjs",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-console") != SeverityWarn {
    t.Errorf("no-console: want warning, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-debugger") != SeverityError {
    t.Errorf("no-debugger: want error, got %v", cfg.Severity("no-debugger"))
  }
}
