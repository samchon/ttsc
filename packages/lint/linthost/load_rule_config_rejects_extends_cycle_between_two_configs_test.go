package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsExtendsCycleBetweenTwoConfigs verifies that two
// config files that `extends` each other fail fast instead of recursing
// without bound.
//
// `collectConfigObject` resolves `extends` recursively through the config loader;
// executable configs can reuse cached evaluation. The lineage guard reports
// `a -> b -> a` as a cycle before the return hop loads `a.config.json` again,
// rather than eventually rejecting it as an overly deep chain. This case
// asserts the cycle diagnostic and filenames, not read or process counts.
//
//  1. Write `a.config.json` and `b.config.json` that each `extends` the other.
//  2. Call LoadRuleConfig with `configFile: "./a.config.json"`.
//  3. Assert a non-nil error that says `extends cycle detected` and names both
//     files.
//  4. Repeat the original discovery-root cycle and reject its return edge.
//  5. Remove that return edge and accept the adjacent acyclic chain.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig rejects an explicit a-to-b-to-a cycle and LoadConfigResolver rejects the migrated discovered lint.config.json-to-b-to-lint cycle before any rule or native host executes.
// @evidence contracts/testing.md#independent-expectations A finite config-extends lineage must not revisit a file; independently authored two-file graphs and the literal cycle diagnostic establish rejection, with both filenames required for the explicit-path case.
// @evidence contracts/testing.md#distinguishing-cases Preserves the explicit two-node cycle and adds the discovery-root cycle without rules; replacing the return edge with an empty object proves the same two-file chain becomes valid. Self-reference and depth-limit cases remain separate tests.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigRejectsExtendsCycleBetweenTwoConfigs owns both direct Go resolver routes in the selected unit process, using JSON fixture files without script evaluation, native compilation or a child host.
func TestLoadRuleConfigRejectsExtendsCycleBetweenTwoConfigs(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "a.config.json"), `{
    "extends": "./b.config.json",
    "rules": { "no-var": "error" }
  }`)
  writeFile(t, filepath.Join(dir, "b.config.json"), `{
    "extends": "./a.config.json",
    "rules": { "eqeqeq": "error" }
  }`)

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./a.config.json",
    },
  }, dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected a cyclic extends chain to fail")
  }
  message := err.Error()
  if !strings.Contains(message, "extends cycle detected") {
    t.Fatalf("error should name the cycle, got %v", err)
  }
  if !strings.Contains(message, "a.config.json") || !strings.Contains(message, "b.config.json") {
    t.Fatalf("error should name both files in the cycle, got %v", err)
  }

  discoveredRoot := t.TempDir()
  writeFile(t, filepath.Join(discoveredRoot, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(discoveredRoot, "lint.config.json"), `{"extends":"./b.config.json"}`)
  base := filepath.Join(discoveredRoot, "b.config.json")
  writeFile(t, base, `{"extends":"./lint.config.json"}`)
  _, discoveredErr := LoadConfigResolver(&PluginEntry{}, discoveredRoot, "tsconfig.json")
  if discoveredErr == nil || !strings.Contains(discoveredErr.Error(), "extends cycle detected") {
    t.Fatalf("discovered cycle error = %v, want extends cycle detected", discoveredErr)
  }
  writeFile(t, base, "{}")
  if _, err := LoadConfigResolver(&PluginEntry{}, discoveredRoot, "tsconfig.json"); err != nil {
    t.Fatalf("acyclic discovered chain rejected: %v", err)
  }
}
