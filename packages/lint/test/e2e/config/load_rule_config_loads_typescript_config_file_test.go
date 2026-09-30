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
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig executes the typed default-export module and resolves no-explicit-any as error.
// @evidence contracts/testing.md#independent-expectations The literal typed module independently exports error for the named rule.
// @evidence contracts/testing.md#distinguishing-cases Owns basic typed default-export routing; spread, async factory and format-only cases exercise distinct typed outputs.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigLoadsTypeScriptConfigFile is physically owned by test/e2e/config and called once with its unchanged name under TestSelectedLintBoundaries; all existing assertions and helpers remain in the flat Go overlay.
// @evidence contracts/e2e.md#necessary-boundary The actual ttsx transpilation/evaluation process must deliver its default export to Go; native map parsing alone cannot prove it.
// @evidence contracts/e2e.md#shared-execution One typed evaluator request uses the existing ttsx/compiler artifact and the single compiled Go harness.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns each mutable fixture and t.Setenv restores changed environment; the production evaluator waits for each child and defers scratch removal and context cancellation on return; an external process kill cannot guarantee deferred cleanup. Distinct absolute config identities prevent cross-case cached answers, while intentional mutation and recovery states remain observable.
// @evidence contracts/e2e.md#preserved-coverage Every original fixture, test-function body, assertion and helper is retained byte-for-byte; portable config units keep their separate selection and this move only makes the existing real boundary ownership physical.
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
