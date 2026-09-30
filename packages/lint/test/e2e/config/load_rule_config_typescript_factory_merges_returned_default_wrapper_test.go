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
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver preserves async dynamic-import rules, local ignores, semi never options and both published config paths, then refreshes error to warning after a helper-only edit.
// @evidence contracts/testing.md#independent-expectations Literal shared config values, local ignore glob and explicitly named two source paths independently define all expected results.
// @evidence contracts/testing.md#distinguishing-cases Owns logging async factory output, default wrapper composition, main versus ignored path, format transport and unchanged entry with changed helper.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigTypeScriptFactoryMergesReturnedDefaultWrapper is physically owned by test/e2e/config and called once with its unchanged name under TestSelectedLintBoundaries; all existing assertions and helpers remain in the flat Go overlay.
// @evidence contracts/e2e.md#necessary-boundary Real async typed module evaluation, private output channel and dependency-aware Go cache must work together.
// @evidence contracts/e2e.md#shared-execution The first request and helper-invalidated request intentionally differ; both reuse the existing ttsx/compiler artifact without sharing mutable project answers.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns each mutable fixture and t.Setenv restores changed environment; the production evaluator waits for each child and defers scratch removal and context cancellation on return; an external process kill cannot guarantee deferred cleanup. Distinct absolute config identities prevent cross-case cached answers, while intentional mutation and recovery states remain observable.
// @evidence contracts/e2e.md#preserved-coverage Every original fixture, test-function body, assertion and helper is retained byte-for-byte; portable config units keep their separate selection and this move only makes the existing real boundary ownership physical.
func TestLoadRuleConfigTypeScriptFactoryMergesReturnedDefaultWrapper(t *testing.T) {
  // This case has reported a config's own import missing from the published
  // paths on Windows, where the temporary directory carries a short component.
  // Ask the loader to report the graph it built, so a failure names the URLs it
  // resolved instead of only the dependencies that survived them.
  t.Setenv("TTSC_LINT_DEBUG_CONFIG_GRAPH", "1")
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
      if sameConfigTestPath(actual, expected) {
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
