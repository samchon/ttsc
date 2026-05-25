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
// `collectConfigObject` resolves `extends` recursively, reading (and, for
// .ts/.js files, subprocess-evaluating) every named config file. Without a
// visited-path guard a cycle `a -> b -> a` would recurse — and re-spawn a
// loader subprocess — forever. The guard must reject the cycle before the
// second hop re-reads `a.config.json`.
//
//  1. Write `a.config.json` and `b.config.json` that each `extends` the other.
//  2. Call LoadRuleConfig with `configFile: "./a.config.json"`.
//  3. Assert a non-nil error that says `extends cycle detected` and names both
//     files.
func TestLoadRuleConfigRejectsExtendsCycleBetweenTwoConfigs(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "a.config.json"), `{
    "extends": "./b.config.json",
    "rules": { "noVar": "error" }
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
}
