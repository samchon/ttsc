package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigTypeScriptFactoryMergesReturnedDefaultWrapper verifies async factory composition.
//
// A `lint.config.ts` factory can dynamically import a shared config and return
// a spread module wrapper with local keys. The loader must normalize the value
// after the factory call, otherwise only the local keys survive and inherited
// rules or format options disappear.
//
//  1. Write a shared `.ts` config with rules and format options.
//  2. Write a logging async package config that dynamically imports and spreads
//     it, proving stdout cannot corrupt the private result channel.
//  3. Assert shared rules and format options survive beside the local ignores.
//  4. Assert the executable config and imported helper are both published as
//     config paths, then change only the helper and observe fresh rules.
func TestLoadRuleConfigTypeScriptFactoryMergesReturnedDefaultWrapper(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "shared-lint.config.ts"), `export default {
  format: { semi: false },
  rules: {
    "no-debugger": "error",
  },
};`)
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.ts"), `export default async () => {
  console.log("loading TypeScript lint config");
  const shared = await import("./shared-lint.config.ts");
  return {
    ...shared,
    ignores: ["src/functional/**/*.ts"],
  };
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

  raw := resolver.RuleOptions("format/semi")
  if len(raw) == 0 {
    t.Fatal("format block was dropped: formatSemi has no options")
  }
  var opts struct {
    Prefer string `json:"prefer"`
  }
  if err := json.Unmarshal(raw, &opts); err != nil {
    t.Fatalf("decode formatSemi options: %v", err)
  }
  if opts.Prefer != "never" {
    t.Fatalf("prefer want \"never\" from shared format, got %q", opts.Prefer)
  }

  paths := resolver.(interface{ ConfigPaths() []string }).ConfigPaths()
  for _, expected := range []string{
    filepath.Join(dir, "ttsc-lint.config.ts"),
    filepath.Join(dir, "shared-lint.config.ts"),
  } {
    found := false
    for _, actual := range paths {
      if filepath.Clean(actual) == filepath.Clean(expected) {
        found = true
        break
      }
    }
    if !found {
      t.Fatalf("ConfigPaths omitted %s from %v", expected, paths)
    }
  }

  writeFile(t, filepath.Join(dir, "shared-lint.config.ts"), `export default {
  format: { semi: false },
  rules: {
    "no-debugger": "warning",
  },
};`)
  refreshed, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "configFile": "./ttsc-lint.config.ts",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver after helper edit: %v", err)
  }
  if got := refreshed.ResolveRules(filepath.Join(dir, "src", "main.ts")).
    Rules.Severity("no-debugger"); got != SeverityWarn {
    t.Fatalf("helper-only edit stayed cached: want warning, got %v", got)
  }
}
