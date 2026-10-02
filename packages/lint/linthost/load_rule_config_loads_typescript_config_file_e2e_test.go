//go:build e2e

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
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig executes the typed default-export module and resolves no-explicit-any as error.
// @evidence contracts/testing.md#independent-expectations The literal typed module independently exports error for the named rule.
// @evidence contracts/testing.md#distinguishing-cases Owns basic typed default-export routing; spread, async factory and format-only cases exercise distinct typed outputs.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestLoadRuleConfigLoadsTypeScriptConfigFile by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
func TestLoadRuleConfigLoadsTypeScriptConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.ts"), `const config = {
    rules: {
      "typescript/no-explicit-any": "error",
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
  if cfg.Severity("typescript/no-explicit-any") != SeverityError {
    t.Errorf("noExplicitAny: want error, got %v", cfg.Severity("typescript/no-explicit-any"))
  }
}
