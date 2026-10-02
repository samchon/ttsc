//go:build e2e

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
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig evaluates the CJS module and resolves no-console as warning and no-debugger as error.
// @evidence contracts/testing.md#independent-expectations Literal CJS rule declarations independently specify the two expected severities.
// @evidence contracts/testing.md#distinguishing-cases Owns two unequal CJS rule severities; typed routing and format-only transport have separate boundary entries.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestLoadRuleConfigLoadsJavaScriptConfigFile by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
func TestLoadRuleConfigLoadsJavaScriptConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), `module.exports = {
    rules: {
      "no-console": "warning",
      "no-debugger": "error",
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
  if cfg.Severity("no-console") != SeverityWarn {
    t.Errorf("noConsole: want warning, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-debugger") != SeverityError {
    t.Errorf("noDebugger: want error, got %v", cfg.Severity("no-debugger"))
  }
}
