package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigTypeScriptConfigMergesSpreadDefaultWrapper verifies shared config composition.
//
// A namespace import of another TypeScript config produces the same plain
// `{ default: config }` shape users hit when CJS/ESM interop wraps a shared
// config. Spreading that wrapper beside local keys must preserve both sides:
// inherited rules and local ignores.
//
// 1. Write a shared `.ts` config with one rule.
// 2. Write a package `.ts` config that spreads the module wrapper and adds an ignore.
// 3. Assert the rule applies to normal files but not to the ignored path.
func TestLoadRuleConfigTypeScriptConfigMergesSpreadDefaultWrapper(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "shared-lint.config.ts"), `export default {
  rules: {
    "no-debugger": "error",
  },
};`)
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.ts"), `import * as shared from "./shared-lint.config.ts";

export default {
  ...shared,
  ignores: ["src/functional/**/*.ts"],
};`)

  resolver, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.ts",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }

  main := resolver.ResolveRules(filepath.Join(dir, "src", "main.ts"))
  if main.Rules.Severity("no-debugger") != SeverityError {
    t.Fatalf("main no-debugger: want error from shared config, got %v", main.Rules.Severity("no-debugger"))
  }
  ignored := resolver.ResolveRules(filepath.Join(dir, "src", "functional", "api.ts"))
  if ignored.Rules.Severity("no-debugger") != SeverityOff {
    t.Fatalf("ignored no-debugger: want off from local ignores, got %v", ignored.Rules.Severity("no-debugger"))
  }
}
