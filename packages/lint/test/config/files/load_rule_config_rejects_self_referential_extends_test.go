package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsSelfReferentialExtends verifies that a config file
// whose `extends` points at itself fails fast.
//
// A one-file cycle escapes any guard that only tracks the *extended* files: it
// is the root config that gets re-entered. The cycle guard must therefore be
// seeded with the root config's own absolute path, so a config that `extends`
// itself is caught on the first hop instead of recursing without bound.
//
//  1. Write a single `a.config.json` whose `extends` names `a.config.json`.
//  2. Call LoadRuleConfig with `configFile: "./a.config.json"`.
//  3. Assert a non-nil error that says `extends cycle detected` and names the
//     file.
func TestLoadRuleConfigRejectsSelfReferentialExtends(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "a.config.json"), `{
    "extends": "./a.config.json",
    "rules": { "noVar": "error" }
  }`)

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./a.config.json",
    },
  }, dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected a self-referential extends to fail")
  }
  message := err.Error()
  if !strings.Contains(message, "extends cycle detected") {
    t.Fatalf("error should name the cycle, got %v", err)
  }
  if !strings.Contains(message, "a.config.json") {
    t.Fatalf("error should name the self-referential file, got %v", err)
  }
}
