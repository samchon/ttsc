package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigLoadsTypeScriptConfigFile verifies that a `configFile` pointing to a .ts
// file is executed via the ttsx subprocess loader and its default export is used as the config.
//
// TypeScript config files require a Node child process with TypeScript support. LoadRuleConfig
// must recognize .ts, .mts, and .cts extensions and route them through the ttsx loader path. A
// regression that sent a .ts path to the JSON parser would fail before even running the
// TypeScript compiler.
//
// 1. Write tsconfig.json and a .ts config file that default-exports an ITtscLintConfig object.
// 2. Call LoadRuleConfig with `configFile: "./ttsc-lint.config.ts"`.
// 3. Assert the exported rule resolves to SeverityError.
func TestLoadRuleConfigLoadsTypeScriptConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.ts"), `const config = {
    rules: {
      "no-explicit-any": "error",
    },
  };
  export default config;`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.ts",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-explicit-any") != SeverityError {
    t.Errorf("noExplicitAny: want error, got %v", cfg.Severity("no-explicit-any"))
  }
}
